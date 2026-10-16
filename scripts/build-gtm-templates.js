const fs = require('fs');
const path = require('path');

const outputDirectory = path.join(__dirname, '..', 'gtm');
const measurementVariable = '{{CFG - GA4 Measurement ID}}';
const measurementPlaceholder = 'G-XXXXXXXXXX';
const measurementGuardTriggerId = '299';

const baseEvents = [
  ['generate_lead', [['lead_type', 'lead.type'], ['form_id', 'lead.form_id'], ['value', 'lead.value'], ['currency', 'lead.currency']]],
  ['form_start', [['form_id', 'form.id'], ['form_name', 'form.name']]],
  ['form_submit', [['form_id', 'form.id'], ['form_name', 'form.name']]],
  ['click_phone', [['link_text', 'link.text']]],
  ['click_email', [['link_text', 'link.text']]],
  ['file_download', [['file_name', 'file.name'], ['file_extension', 'file.extension'], ['link_url', 'link.url']]],
  ['outbound_click', [['link_domain', 'link.domain'], ['link_url', 'link.url']]],
  ['search', [['search_term', 'search.term']]],
  ['cta_click', [['cta_id', 'cta.id'], ['cta_name', 'cta.name'], ['cta_location', 'cta.location']]]
];

const ecommerceEvents = [
  'view_item_list', 'select_item', 'view_item', 'add_to_cart', 'remove_from_cart',
  'view_cart', 'begin_checkout', 'add_shipping_info', 'add_payment_info', 'purchase',
  'refund', 'view_promotion', 'select_promotion', 'add_to_wishlist'
];

function parameter(type, key, value) {
  return { type, key, value };
}

function eventParameters(entries) {
  if (!entries.length) return null;
  return {
    type: 'LIST',
    key: 'eventParameters',
    list: entries.map(([name, variable]) => ({
      type: 'MAP',
      map: [
        parameter('TEMPLATE', 'name', name),
        parameter('TEMPLATE', 'value', `{{DLV - ${variable}}}`)
      ]
    }))
  };
}

function googleTag() {
  return {
    accountId: '0', containerId: '0', tagId: '1', name: 'BASE - Google tag', type: 'googtag',
    parameter: [parameter('TEMPLATE', 'tagId', measurementVariable)],
    firingTriggerId: ['2147479553'], blockingTriggerId: [measurementGuardTriggerId], tagFiringOption: 'ONCE_PER_EVENT',
    monitoringMetadata: { type: 'MAP' }, consentSettings: { consentStatus: 'NOT_SET' }, fingerprint: '0'
  };
}

function eventTag(name, id, triggerId, entries, ecommerce) {
  const parameters = [];
  if (ecommerce) {
    parameters.push(parameter('BOOLEAN', 'sendEcommerceData', 'true'));
    parameters.push(parameter('TEMPLATE', 'getEcommerceDataFrom', 'dataLayer'));
  }
  parameters.push(parameter('BOOLEAN', 'enhancedUserId', 'false'));
  parameters.push(parameter('TEMPLATE', 'eventName', name));
  parameters.push(parameter('TEMPLATE', 'measurementIdOverride', measurementVariable));
  const mapped = eventParameters(entries || []);
  if (mapped) parameters.push(mapped);
  return {
    accountId: '0', containerId: '0', tagId: String(id),
    name: `${ecommerce ? 'ECOMMERCE' : 'BASE'} - GA4 - ${name}`, type: 'gaawe', parameter: parameters,
    firingTriggerId: [String(triggerId)], blockingTriggerId: [measurementGuardTriggerId], tagFiringOption: 'ONCE_PER_EVENT',
    monitoringMetadata: { type: 'MAP' }, consentSettings: { consentStatus: 'NOT_SET' }, fingerprint: '0'
  };
}

function trigger(name, id) {
  return {
    accountId: '0', containerId: '0', triggerId: String(id),
    name: `${id >= 500 ? 'ECOMMERCE' : 'BASE'} - CE - ${name}`,
    type: 'CUSTOM_EVENT', customEventFilter: [{ type: 'EQUALS', parameter: [
      parameter('TEMPLATE', 'arg0', '{{_event}}'), parameter('TEMPLATE', 'arg1', name)
    ] }], fingerprint: '0'
  };
}

function measurementGuardTrigger() {
  return {
    accountId: '0', containerId: '0', triggerId: measurementGuardTriggerId,
    name: 'BASE - BLOCK - Measurement ID not configured', type: 'CUSTOM_EVENT',
    customEventFilter: [{ type: 'MATCH_REGEX', parameter: [
      parameter('TEMPLATE', 'arg0', '{{_event}}'), parameter('TEMPLATE', 'arg1', '.*')
    ] }],
    filter: [{ type: 'EQUALS', parameter: [
      parameter('TEMPLATE', 'arg0', measurementVariable), parameter('TEMPLATE', 'arg1', measurementPlaceholder)
    ] }],
    fingerprint: '0'
  };
}

function variable(name, id) {
  if (name === 'CFG - GA4 Measurement ID') {
    return {
      accountId: '0', containerId: '0', variableId: String(id), name, type: 'c',
      parameter: [parameter('TEMPLATE', 'value', measurementPlaceholder)], fingerprint: '0',
      notes: 'Remplacer par le Measurement ID réel. Une exception bloque toutes les balises tant que cette valeur est présente.'
    };
  }
  const dataLayerName = name.replace(/^DLV - /, '');
  return {
    accountId: '0', containerId: '0', variableId: String(id), name, type: 'v',
    parameter: [parameter('INTEGER', 'dataLayerVersion', '2'), parameter('TEMPLATE', 'name', dataLayerName)],
    fingerprint: '0'
  };
}

function container(name, description, includeEcommerce) {
  const tags = [googleTag()];
  const triggers = [measurementGuardTrigger()];
  const dlvNames = new Set();

  baseEvents.forEach(([eventName, entries], index) => {
    const triggerId = 201 + index;
    tags.push(eventTag(eventName, 101 + index, triggerId, entries, false));
    triggers.push(trigger(eventName, triggerId));
    entries.forEach(([, dataLayerName]) => dlvNames.add(dataLayerName));
  });

  if (includeEcommerce) {
    ecommerceEvents.forEach((eventName, index) => {
      const triggerId = 501 + index;
      tags.push(eventTag(eventName, 401 + index, triggerId, [], true));
      triggers.push(trigger(eventName, triggerId));
    });
  }

  const variables = [variable('CFG - GA4 Measurement ID', 1)];
  Array.from(dlvNames).sort().forEach((dataLayerName, index) => {
    variables.push(variable(`DLV - ${dataLayerName}`, 101 + index));
  });

  return {
    exportFormatVersion: 2,
    exportTime: '2026-10-16 12:00:00',
    containerVersion: {
      path: 'accounts/0/containers/0/versions/0', accountId: '0', containerId: '0', containerVersionId: '0',
      name, description,
      container: {
        path: 'accounts/0/containers/0', accountId: '0', containerId: '0', name: 'ETW Templates',
        publicId: 'GTM-XXXXXXX', usageContext: ['WEB'], fingerprint: '0'
      },
      tag: tags, trigger: triggers, variable: variables,
      builtInVariable: [{ accountId: '0', containerId: '0', type: 'EVENT', name: 'Event' }],
      fingerprint: '0', tagManagerUrl: 'https://tagmanager.google.com/'
    }
  };
}

fs.mkdirSync(outputDirectory, { recursive: true });
const base = container(
  'ETW - GA4 Base - v1.0',
  'Socle GA4 générique ETW : Google tag et événements de leads/interactions pilotés par le contrat dataLayer ETW v1.0.',
  false
);
const ecommerce = container(
  'ETW - GA4 Ecommerce - v1.0',
  'Superset strict de ETW - GA4 Base v1.0 avec les 14 événements e-commerce GA4 du contrat ETW v1.0.',
  true
);

fs.writeFileSync(path.join(outputDirectory, 'etw-ga4-base-v1.0.json'), JSON.stringify(base, null, 2) + '\n');
fs.writeFileSync(path.join(outputDirectory, 'etw-ga4-ecommerce-v1.0.json'), JSON.stringify(ecommerce, null, 2) + '\n');
console.log('GTM templates generated.');
