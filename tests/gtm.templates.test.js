const fs = require('fs');
const assert = require('assert');

const basePath = require('path').join(__dirname, '../gtm/etw-ga4-base-v1.0.json');
const ecommercePath = require('path').join(__dirname, '../gtm/etw-ga4-ecommerce-v1.0.json');
const baseEvents = ['generate_lead', 'form_start', 'form_submit', 'click_phone', 'click_email', 'file_download', 'outbound_click', 'search', 'cta_click'];
const ecommerceEvents = ['view_item_list', 'select_item', 'view_item', 'add_to_cart', 'remove_from_cart', 'view_cart', 'begin_checkout', 'add_shipping_info', 'add_payment_info', 'purchase', 'refund', 'view_promotion', 'select_promotion', 'add_to_wishlist'];

function read(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8')).containerVersion;
}

function eventName(tag) {
  const parameter = (tag.parameter || []).find((entry) => entry.key === 'eventName');
  return parameter && parameter.value;
}

function canonical(entry) {
  const copy = JSON.parse(JSON.stringify(entry));
  delete copy.path;
  return JSON.stringify(copy);
}

function references(value, found = new Set()) {
  if (typeof value === 'string') {
    const matches = value.matchAll(/\{\{([^}]+)\}\}/g);
    for (const match of matches) found.add(match[1]);
  } else if (Array.isArray(value)) {
    value.forEach((entry) => references(entry, found));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => references(entry, found));
  }
  return found;
}

function validate(container, expectedEvents) {
  const tags = container.tag || [];
  const triggers = container.trigger || [];
  const variables = container.variable || [];
  const triggerIds = new Set(triggers.map((trigger) => String(trigger.triggerId)));
  const names = new Set(variables.map((variable) => variable.name));
  const tagEvents = tags.map(eventName).filter(Boolean);

  assert.deepStrictEqual([...tagEvents].sort(), [...expectedEvents].sort(), 'unexpected GA4 event set');
  tags.forEach((tag) => {
    (tag.firingTriggerId || []).forEach((id) => {
      assert(id === '2147479553' || triggerIds.has(String(id)), `broken trigger reference ${id}`);
    });
    (tag.blockingTriggerId || []).forEach((id) => {
      assert(triggerIds.has(String(id)), `broken blocking trigger reference ${id}`);
    });
    assert((tag.blockingTriggerId || []).includes('299'), `${tag.name} is not protected against the placeholder`);
    assert.strictEqual(tag.tagFiringOption, 'ONCE_PER_EVENT', `${tag.name} must fire once per event`);
  });
  assert.strictEqual(new Set(tags.map((tag) => tag.name)).size, tags.length, 'duplicate tag name');
  assert.strictEqual(new Set(triggers.map((trigger) => trigger.name)).size, triggers.length, 'duplicate trigger name');
  assert.strictEqual(new Set(variables.map((variable) => variable.name)).size, variables.length, 'duplicate variable name');
  const used = references(tags);
  names.forEach((name) => assert(used.has(name), `dead variable ${name}`));
  used.forEach((name) => assert(names.has(name) || name === '_event', `missing variable ${name}`));
  const raw = JSON.stringify(container).toLowerCase();
  ['prestashop', 'woocommerce', 'a_completer', '.add-to-cart', 'btn-contact'].forEach((term) => {
    assert(!raw.includes(term), `forbidden GTM coupling: ${term}`);
  });
  const cfg = variables.find((variable) => variable.name === 'CFG - GA4 Measurement ID');
  assert(cfg, 'measurement variable missing');
  assert.strictEqual(cfg.parameter[0].value, 'G-XXXXXXXXXX', 'unexpected measurement placeholder');
  assert(triggers.some((trigger) => String(trigger.triggerId) === '299'), 'measurement guard trigger missing');
}

const base = read(basePath);
const ecommerce = read(ecommercePath);
validate(base, baseEvents);
validate(ecommerce, baseEvents.concat(ecommerceEvents));

['tag', 'trigger', 'variable', 'builtInVariable'].forEach((collection) => {
  const baseEntries = (base[collection] || []).map(canonical);
  const ecommerceEntries = new Set((ecommerce[collection] || []).map(canonical));
  baseEntries.forEach((entry) => assert(ecommerceEntries.has(entry), `ecommerce is not a strict superset for ${collection}`));
});

console.log('gtm.templates.test.js: OK');
