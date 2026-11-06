import React, { useState, useEffect, useRef } from 'react'
import api from '../services/api.js'
import './DeveloperApi.css'

import { BASE_URL } from '../config.js'

const getCurlExample = (api, apiKey = 'YOUR_API_KEY') => {
  const fullUrl = `${BASE_URL}${api.endpoint}`
  if (api.method === 'GET') {
    return `curl -X GET "${fullUrl}" \\\n  -H "x-api-key: ${apiKey}"`
  }
  return `curl -X POST "${fullUrl}" \\\n  -H "x-api-key: ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(api.reqExample, null, 2)}'`
}

const getPostmanExample = (api, apiKey = 'YOUR_API_KEY') => {
  const fullUrl = `${BASE_URL}${api.endpoint}`
  return JSON.stringify({
    info: {
      name: api.title,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item: [{
      name: api.title,
      request: {
        method: api.method,
        header: [
          { key: "x-api-key", value: apiKey, type: "text" },
          { key: "Content-Type", value: "application/json", type: "text" }
        ],
        body: {
          mode: "raw",
          raw: JSON.stringify(api.reqExample, null, 2)
        },
        url: {
          raw: fullUrl,
          protocol: fullUrl.startsWith('https') ? 'https' : 'http',
          host: [fullUrl.replace(/^https?:\/\//, '').split('/')[0]],
          path: api.endpoint.split('/').filter(Boolean)
        }
      }
    }]
  }, null, 2)
}

const COLOR_THEMES = ['blue', 'green', 'purple', 'orange', 'red']

// 21 Specified APIs in exact order
const API_DOCUMENTATION = [
  {
    id: 1,
    title: 'Send Official WA API',
    method: 'POST',
    endpoint: '/api/v1/developer/send-official-wa',
    description: 'Send standard official WhatsApp message or media dispatch to a single recipient.',
    params: [
      { name: 'number', required: 'Yes', type: 'String', desc: 'Recipient WhatsApp phone number with country code', example: '919876543210' },
      { name: 'message', required: 'No', type: 'String', desc: 'Text body of the WhatsApp message', example: 'Hello! Welcome to OfficialWA.' },
      { name: 'media_url', required: 'No', type: 'String', desc: 'Public URL of image, document or video asset', example: 'https://example.com/image.png' }
    ],
    reqExample: { number: '919876543210', message: 'Hello! Welcome to OfficialWA.' },
    resExample: {
      status: 'success',
      code: 200,
      message: 'Message queued and dispatched successfully',
      data: { message_id: 'wamid.HBgL919876543210ABC', recipient: '919876543210', status: 'sent', timestamp: '2026-07-31T11:30:00.000Z' }
    },
    errExample: { status: 'error', code: 400, message: 'Missing required parameter(s): number' }
  },
  {
    id: 2,
    title: 'Send Official WA JSON API',
    method: 'POST',
    endpoint: '/api/v1/developer/send-official-wa-json',
    description: 'Send structured WhatsApp message using complete JSON payload definition.',
    params: [
      { name: 'to', required: 'Yes', type: 'String', desc: 'Target mobile number', example: '919876543210' },
      { name: 'type', required: 'Yes', type: 'String', desc: 'Type of payload (template / text / media)', example: 'template' },
      { name: 'template', required: 'No', type: 'Object', desc: 'Template specification object', example: '{"name": "hello_world", "language": "en"}' }
    ],
    reqExample: { to: '919876543210', type: 'template', template: { name: 'welcome_offer', language: 'en' } },
    resExample: {
      status: 'success',
      code: 200,
      message: 'Official WA JSON payload processed successfully',
      data: { message_id: 'wamid.HBgLJSON987654321', to: '919876543210', type: 'template', status: 'sent' }
    },
    errExample: { status: 'error', code: 401, message: 'Unauthorized. Invalid or inactive API Key.' }
  },
  {
    id: 3,
    title: 'Send Official WA OTP Template API',
    method: 'POST',
    endpoint: '/api/v1/developer/send-otp-template',
    description: 'Send authentication One-Time Password via approved Meta WhatsApp OTP template.',
    params: [
      { name: 'number', required: 'Yes', type: 'String', desc: 'User phone number with country code', example: '919876543210' },
      { name: 'otp', required: 'Yes', type: 'String', desc: 'Generated numeric OTP code', example: '482910' },
      { name: 'template_name', required: 'No', type: 'String', desc: 'Approved OTP template identifier', example: 'official_wa_otp' }
    ],
    reqExample: { number: '919876543210', otp: '482910', template_name: 'official_wa_otp' },
    resExample: {
      status: 'success',
      code: 200,
      message: 'OTP Template message sent successfully',
      data: { otp_id: 104, recipient: '919876543210', otp: '482910', template_name: 'official_wa_otp', status: 'sent', expires_at: '2026-07-31T11:40:00.000Z' }
    },
    errExample: { status: 'error', code: 400, message: 'Missing required parameter(s): otp' }
  },
  {
    id: 4,
    title: 'OfficialWA OTP Template JSON API',
    method: 'POST',
    endpoint: '/api/v1/developer/send-otp-template-json',
    description: 'Dispatch OTP authentication template using structured JSON request body.',
    params: [
      { name: 'recipient', required: 'Yes', type: 'String', desc: 'Target mobile number', example: '919876543210' },
      { name: 'otp', required: 'Yes', type: 'String', desc: 'OTP value to inject into template', example: '951234' },
      { name: 'template', required: 'No', type: 'Object', desc: 'Template meta information object', example: '{"name": "auth_otp_json"}' }
    ],
    reqExample: { recipient: '919876543210', otp: '951234', template: { name: 'auth_otp_json' } },
    resExample: {
      status: 'success',
      code: 200,
      message: 'OTP Template JSON dispatches successfully',
      data: { otp_id: 105, to: '919876543210', otp: '951234', template: 'auth_otp_json', payload_status: 'dispatched' }
    },
    errExample: { status: 'error', code: 400, message: 'Missing required parameter(s): recipient' }
  },
  {
    id: 5,
    title: 'Send Official WA Group API',
    method: 'POST',
    endpoint: '/api/v1/developer/send-group-wa',
    description: 'Trigger a targeted WhatsApp campaign to a pre-configured contact group.',
    params: [
      { name: 'group_id', required: 'Yes', type: 'String', desc: 'Unique group identifier or group name', example: 'GRP_VIP_CLIENTS' },
      { name: 'group_name', required: 'No', type: 'String', desc: 'Friendly name of the contact group', example: 'VIP Clients' },
      { name: 'message', required: 'No', type: 'String', desc: 'Custom text message or template parameters', example: 'Exclusive weekend deal for VIP members!' }
    ],
    reqExample: { group_id: 'GRP_VIP_CLIENTS', message: 'Exclusive weekend deal for VIP members!' },
    resExample: {
      status: 'success',
      code: 200,
      message: 'Group WA message queued for group: GRP_VIP_CLIENTS',
      data: { campaign_id: 88, group_id: 'GRP_VIP_CLIENTS', group_name: 'GRP_VIP_CLIENTS', status: 'queued', members_targeted: 10 }
    },
    errExample: { status: 'error', code: 400, message: 'Group not found' }
  },
  {
    id: 6,
    title: 'Official WA Group JSON API',
    method: 'POST',
    endpoint: '/api/v1/developer/send-group-wa-json',
    description: 'Broadcast JSON payload messages to group members asynchronously.',
    params: [
      { name: 'group_name', required: 'Yes', type: 'String', desc: 'Target contact group name', example: 'High Net Worth Clients' },
      { name: 'members', required: 'No', type: 'Array', desc: 'Array of custom mobile numbers', example: '["919876543210", "919876543211"]' }
    ],
    reqExample: { group_name: 'High Net Worth Clients', members: ['919876543210', '919876543211'] },
    resExample: {
      status: 'success',
      code: 200,
      message: 'Group JSON request accepted',
      data: { campaign_id: 89, group: 'High Net Worth Clients', status: 'queued', targeted_count: 2 }
    },
    errExample: { status: 'error', code: 400, message: 'Invalid members format' }
  },
  {
    id: 7,
    title: 'Official WA Tag API',
    method: 'POST',
    endpoint: '/api/v1/developer/send-tag-wa',
    description: 'Send WhatsApp broadcast to all audience contacts associated with a specific Tag.',
    params: [
      { name: 'tag_name', required: 'Yes', type: 'String', desc: 'Registered tag identifier', example: 'Leads2026' },
      { name: 'message', required: 'No', type: 'String', desc: 'Campaign text body', example: 'Special discount for recent leads!' }
    ],
    reqExample: { tag_name: 'Leads2026', message: 'Special discount for recent leads!' },
    resExample: {
      status: 'success',
      code: 200,
      message: 'Message broadcast triggered for tag: Leads2026',
      data: { campaign_id: 90, tag: 'Leads2026', status: 'queued', recipients_queued: 25 }
    },
    errExample: { status: 'error', code: 400, message: 'Tag name required' }
  },
  {
    id: 8,
    title: 'Send Official WA JSON API (Clevertap)',
    method: 'POST',
    endpoint: '/api/v1/developer/clevertap/send-wa',
    description: 'Clevertap-compatible webhook API endpoint for seamless automated engagement dispatches.',
    params: [
      { name: 'to', required: 'Yes', type: 'String', desc: 'Recipient phone number', example: '919876543210' },
      { name: 'eventId', required: 'No', type: 'String', desc: 'Clevertap event ID', example: 'ct_event_99182' },
      { name: 'payload', required: 'No', type: 'Object', desc: 'Clevertap custom event variables', example: '{"cart_total": 4999}' }
    ],
    reqExample: { to: '919876543210', eventId: 'ct_event_99182', payload: { cart_total: 4999 } },
    resExample: {
      status: 'success',
      code: 200,
      message: 'Clevertap webhook event processed',
      data: { clevertap_id: 'ct_event_99182', to: '919876543210', status: 'accepted', log_id: 112 }
    },
    errExample: { status: 'error', code: 400, message: 'Recipient number missing' }
  },
  {
    id: 9,
    title: 'Generate OTP API',
    method: 'POST',
    endpoint: '/api/v1/developer/otp/generate',
    description: 'Generate a secure numeric OTP code, save entry in database logs, and return status.',
    params: [
      { name: 'number', required: 'Yes', type: 'String', desc: 'Phone number to generate OTP for', example: '919876543210' },
      { name: 'digits', required: 'No', type: 'Number', desc: 'Length of OTP code (4 to 8, default 6)', example: 6 },
      { name: 'template_name', required: 'No', type: 'String', desc: 'Template name', example: 'otp_auth' }
    ],
    reqExample: { number: '919876543210', digits: 6 },
    resExample: {
      status: 'success',
      code: 200,
      message: 'OTP generated and saved',
      data: { otp_id: 12, phone: '919876543210', otp: '741258', expires_at: '2026-07-31T11:40:00.000Z', status: 'pending' }
    },
    errExample: { status: 'error', code: 400, message: 'Missing required parameter(s): number' }
  },
  {
    id: 10,
    title: 'Validate OTP API',
    method: 'POST',
    endpoint: '/api/v1/developer/otp/validate',
    description: 'Validate customer entered OTP code against stored pending OTP logs.',
    params: [
      { name: 'number', required: 'Yes', type: 'String', desc: 'Phone number of customer', example: '919876543210' },
      { name: 'otp', required: 'Yes', type: 'String', desc: 'OTP code entered by customer', example: '741258' }
    ],
    reqExample: { number: '919876543210', otp: '741258' },
    resExample: {
      status: 'success',
      code: 200,
      message: 'OTP verified successfully',
      data: { verified: true, otp_id: 12, phone: '919876543210' }
    },
    errExample: { status: 'error', code: 400, message: 'Invalid or expired OTP', data: { verified: false } }
  },
  {
    id: 11,
    title: 'Add WAAPI Number',
    method: 'POST',
    endpoint: '/api/v1/developer/wa-number/add',
    description: 'Add a new phone contact into the OfficialWA CRM directory.',
    params: [
      { name: 'phone', required: 'Yes', type: 'String', desc: 'Mobile number with country code', example: '919876543210' },
      { name: 'name', required: 'No', type: 'String', desc: 'Full contact name', example: 'John Doe' },
      { name: 'group_name', required: 'No', type: 'String', desc: 'Contact group designation', example: 'Retail Customers' }
    ],
    reqExample: { phone: '919876543210', name: 'John Doe', group_name: 'Retail Customers' },
    resExample: {
      status: 'success',
      code: 200,
      message: 'WhatsApp number added to system directory',
      data: { name: 'John Doe', phone: '919876543210', group: 'Retail Customers', added_at: '2026-07-31T11:30:00.000Z' }
    },
    errExample: { status: 'error', code: 400, message: 'Missing required parameter(s): phone' }
  },
  {
    id: 12,
    title: 'Add WAAPI Number JSON API',
    method: 'POST',
    endpoint: '/api/v1/developer/wa-number/add-json',
    description: 'Bulk insert contacts into system directory using JSON array payload.',
    params: [
      { name: 'contacts', required: 'Yes', type: 'Array', desc: 'Array of contact objects containing phone & name', example: '[{"phone": "919876543210", "name": "Alice"}]' }
    ],
    reqExample: { contacts: [{ phone: '919876543210', name: 'Alice' }, { phone: '919876543211', name: 'Bob' }] },
    resExample: {
      status: 'success',
      code: 200,
      message: '2 contacts added via JSON payload',
      data: { processed: 2, status: 'completed', timestamp: '2026-07-31T11:30:00.000Z' }
    },
    errExample: { status: 'error', code: 400, message: 'Invalid contacts list' }
  },
  {
    id: 13,
    title: 'Save WAFilter Number',
    method: 'POST',
    endpoint: '/api/v1/developer/wafilter/save',
    description: 'Upload and save a phone list to perform active WhatsApp number filtering.',
    params: [
      { name: 'list_name', required: 'No', type: 'String', desc: 'Filter campaign list label', example: 'July Upload List' },
      { name: 'numbers', required: 'Yes', type: 'Array/String', desc: 'Comma-separated string or array of mobile numbers', example: '["919876543210", "919876543211"]' }
    ],
    reqExample: { list_name: 'July Upload List', numbers: ['919876543210', '919876543211'] },
    resExample: {
      status: 'success',
      code: 200,
      message: 'Filter number list saved successfully',
      data: { filter_list_id: 42, list_name: 'July Upload List', total_numbers: 2 }
    },
    errExample: { status: 'error', code: 400, message: 'No numbers provided for filtering' }
  },
  {
    id: 14,
    title: 'Save WAFilter Number JSON API',
    method: 'POST',
    endpoint: '/api/v1/developer/wafilter/save-json',
    description: 'Save filter list using structured JSON body.',
    params: [
      { name: 'list_name', required: 'No', type: 'String', desc: 'List title', example: 'CRM Export Filter' },
      { name: 'contacts', required: 'Yes', type: 'Array', desc: 'List of numbers or contact objects', example: '["919876543210"]' }
    ],
    reqExample: { list_name: 'CRM Export Filter', contacts: ['919876543210'] },
    resExample: {
      status: 'success',
      code: 200,
      message: 'Filter number list saved successfully',
      data: { filter_list_id: 43, list_name: 'CRM Export Filter', total_numbers: 1 }
    },
    errExample: { status: 'error', code: 400, message: 'Invalid JSON body' }
  },
  {
    id: 15,
    title: 'Check WAFilter Numbers',
    method: 'POST',
    endpoint: '/api/v1/developer/wafilter/check',
    description: 'Run active WhatsApp detection scan on saved filter list and return Active/Inactive status.',
    params: [
      { name: 'filter_list_id', required: 'No', type: 'Number', desc: 'ID of saved filter list', example: 42 },
      { name: 'numbers', required: 'No', type: 'Array', desc: 'Direct array of numbers to check', example: '["919876543210", "919876543219"]' }
    ],
    reqExample: { filter_list_id: 42 },
    resExample: {
      status: 'success',
      code: 200,
      message: 'WhatsApp filter status check complete',
      data: { total_checked: 2, active_count: 2, inactive_count: 0, active_numbers: ['919876543210'], inactive_numbers: [] }
    },
    errExample: { status: 'error', code: 400, message: 'Specify filter_list_id or numbers' }
  },
  {
    id: 16,
    title: 'WAPP API Cancel Scheduled Campaign',
    method: 'POST',
    endpoint: '/api/v1/developer/campaign/cancel',
    description: 'Cancel a pending or scheduled campaign broadcast.',
    params: [
      { name: 'campaign_id', required: 'Yes', type: 'Number', desc: 'ID of the scheduled campaign', example: 88 }
    ],
    reqExample: { campaign_id: 88 },
    resExample: {
      status: 'success',
      code: 200,
      message: 'Scheduled campaign 88 cancelled successfully',
      data: { campaign_id: 88, status: 'cancelled', affected: 1 }
    },
    errExample: { status: 'error', code: 400, message: 'Missing required parameter(s): campaign_id' }
  },
  {
    id: 17,
    title: 'WAPP API Report (By Campaign)',
    method: 'GET',
    endpoint: '/api/v1/developer/reports/by-campaign',
    description: 'Retrieve detailed performance metrics and delivery counts grouped by campaign.',
    params: [],
    reqExample: {},
    resExample: {
      status: 'success',
      code: 200,
      message: 'Campaign report retrieved',
      data: [{ id: 88, campaign_name: 'Group Broadcast: VIP Clients', status: 'cancelled', total_count: 10, created_at: '2026-07-31T11:20:00.000Z' }]
    },
    errExample: { status: 'error', code: 401, message: 'Unauthorized' }
  },
  {
    id: 18,
    title: 'WAPP API Report (By Template)',
    method: 'GET',
    endpoint: '/api/v1/developer/reports/by-template',
    description: 'Retrieve message delivery and read rates broken down by WhatsApp Template.',
    params: [],
    reqExample: {},
    resExample: {
      status: 'success',
      code: 200,
      message: 'Template report retrieved',
      data: [{ template_name: 'official_wa_otp', total_sent: 15, delivered: 15, read: 12 }]
    },
    errExample: { status: 'error', code: 401, message: 'Unauthorized' }
  },
  {
    id: 19,
    title: 'WAPP API Report (By Mobile)',
    method: 'GET',
    endpoint: '/api/v1/developer/reports/by-mobile',
    description: 'Query message dispatches and delivery statuses for a specific mobile phone number.',
    params: [
      { name: 'mobile', required: 'No', type: 'String', desc: 'Mobile number to filter log', example: '919876543210' }
    ],
    reqExample: { mobile: '919876543210' },
    resExample: {
      status: 'success',
      code: 200,
      message: 'Mobile logs report retrieved',
      data: [{ id: 1, recipient: '919876543210', message: 'Hello! Welcome to OfficialWA.', status: 'sent', created_at: '2026-07-31T11:30:00.000Z' }]
    },
    errExample: { status: 'error', code: 401, message: 'Unauthorized' }
  },
  {
    id: 20,
    title: 'WAPP API Summary Report',
    method: 'GET',
    endpoint: '/api/v1/developer/reports/summary',
    description: 'Fetch global metrics summary including Total Sent, Delivered, Read, Failed, and Pending dispatches.',
    params: [],
    reqExample: {},
    resExample: {
      status: 'success',
      code: 200,
      message: 'Summary report generated',
      data: {
        messages: { total: 45, delivered: 42, read: 38, failed: 1, pending: 2 },
        otp: { total: 10, verified: 8 }
      }
    },
    errExample: { status: 'error', code: 401, message: 'Unauthorized' }
  },
  {
    id: 21,
    title: 'WAPP API Incoming Report (By Date)',
    method: 'GET',
    endpoint: '/api/v1/developer/reports/incoming-by-date',
    description: 'Retrieve incoming WhatsApp customer conversations within a specified date range.',
    params: [
      { name: 'start_date', required: 'No', type: 'String (YYYY-MM-DD)', desc: 'Start date filter', example: '2026-07-01' },
      { name: 'end_date', required: 'No', type: 'String (YYYY-MM-DD)', desc: 'End date filter', example: '2026-07-31' }
    ],
    reqExample: { start_date: '2026-07-01', end_date: '2026-07-31' },
    resExample: {
      status: 'success',
      code: 200,
      message: 'Incoming messages report by date retrieved',
      data: [{ id: 1, contact_name: 'John Doe', contact_phone: '919876543210', last_message: 'Hello, I need help with my order', last_message_time: '2026-07-31T11:00:00.000Z' }]
    },
    errExample: { status: 'error', code: 401, message: 'Unauthorized' }
  }
]

export default function DeveloperApi() {
  const [apiKeys, setApiKeys] = useState([])
  const [loadingKeys, setLoadingKeys] = useState(true)
  const [generatingKey, setGeneratingKey] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState(1)
  const [toastMessage, setToastMessage] = useState(null)
  const [activeSnippetTabs, setActiveSnippetTabs] = useState({})

  // API Playground State
  const [selectedApiKey, setSelectedApiKey] = useState('')
  const [selectedEndpointId, setSelectedEndpointId] = useState(1)
  const [playgroundParams, setPlaygroundParams] = useState({})
  const [playgroundLoading, setPlaygroundLoading] = useState(false)
  const [playgroundResponse, setPlaygroundResponse] = useState(null)

  const playgroundRef = useRef(null)

  useEffect(() => {
    fetchApiKeys()
  }, [])

  const fetchApiKeys = async () => {
    try {
      setLoadingKeys(true)
      const res = await api.get('/developer/keys')
      if (res.data.success) {
        setApiKeys(res.data.data)
        if (res.data.data.length > 0 && !selectedApiKey) {
          setSelectedApiKey(res.data.data[0].api_key)
        }
      }
    } catch (err) {
      console.error('Error fetching API keys:', err)
    } finally {
      setLoadingKeys(false)
    }
  }

  const handleGenerateKey = async () => {
    try {
      setGeneratingKey(true)
      const res = await api.post('/developer/keys', {})
      if (res.data.success) {
        showToast('New API Key generated successfully!')
        await fetchApiKeys()
      }
    } catch (err) {
      showToast('Failed to generate API Key: ' + (err.response?.data?.message || err.message))
    } finally {
      setGeneratingKey(false)
    }
  }

  const handleDeleteKey = async (keyId) => {
    if (!window.confirm('Are you sure you want to delete this API Key? Any application using this key will immediately lose access.')) {
      return
    }
    try {
      const res = await api.delete(`/developer/keys/${keyId}`)
      if (res.data.success) {
        showToast('API Key deleted successfully.')
        await fetchApiKeys()
      }
    } catch (err) {
      showToast('Failed to delete key: ' + (err.response?.data?.message || err.message))
    }
  }

  const copyToClipboard = (text, label = 'Content') => {
    navigator.clipboard.writeText(text)
    showToast(`${label} copied to clipboard!`)
  }

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 3000)
  }

  const handleToggleAccordion = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  // Live Playground Execution
  const handleTestInPlayground = (apiItem) => {
    setSelectedEndpointId(apiItem.id)
    const initialParams = {}
    apiItem.params.forEach(p => {
      initialParams[p.name] = p.example || ''
    })
    setPlaygroundParams(initialParams)

    if (playgroundRef.current) {
      playgroundRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handlePlaygroundEndpointChange = (e) => {
    const epId = parseInt(e.target.value, 10)
    setSelectedEndpointId(epId)
    const targetApi = API_DOCUMENTATION.find(a => a.id === epId)
    if (targetApi) {
      const initialParams = {}
      targetApi.params.forEach(p => {
        initialParams[p.name] = p.example || ''
      })
      setPlaygroundParams(initialParams)
    }
  }

  const handleExecutePlayground = async () => {
    const targetApi = API_DOCUMENTATION.find(a => a.id === selectedEndpointId)
    if (!targetApi) return

    setPlaygroundLoading(true)
    setPlaygroundResponse(null)
    const startTime = Date.now()

    try {
      const headers = {}
      if (selectedApiKey) {
        headers['x-api-key'] = selectedApiKey
      }

      const endpointPath = targetApi.endpoint.startsWith('/api') ? targetApi.endpoint.slice(4) : targetApi.endpoint

      let res
      if (targetApi.method === 'GET') {
        res = await api.get(endpointPath, {
          params: playgroundParams,
          headers
        })
      } else {
        res = await api.post(endpointPath, playgroundParams, {
          headers
        })
      }

      const duration = Date.now() - startTime
      setPlaygroundResponse({
        status: res.status,
        statusText: res.statusText,
        duration: `${duration}ms`,
        data: res.data
      })
    } catch (err) {
      const duration = Date.now() - startTime
      setPlaygroundResponse({
        status: err.response?.status || 500,
        statusText: err.response?.statusText || 'Error',
        duration: `${duration}ms`,
        data: err.response?.data || { error: err.message }
      })
    } finally {
      setPlaygroundLoading(false)
    }
  }

  // Filtered APIs based on search
  const filteredApis = API_DOCUMENTATION.filter(api => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true
    return (
      api.title.toLowerCase().includes(query) ||
      api.endpoint.toLowerCase().includes(query) ||
      api.description.toLowerCase().includes(query)
    )
  })

  const currentPlaygroundApi = API_DOCUMENTATION.find(a => a.id === selectedEndpointId) || API_DOCUMENTATION[0]

  return (
    <div className="dev-api-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="dev-api-toast">
          <span>✅ {toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="dev-api-header">
        <div className="dev-api-title-group">
          <h1>
            <span>Developer API</span>
          </h1>
          <p>Generate API Keys, access REST API documentation, and test WhatsApp Cloud integration endpoints.</p>
        </div>
        <button
          type="button"
          className="btn-generate-key"
          onClick={handleGenerateKey}
          disabled={generatingKey}
        >
          <span>🔑</span>
          <span>{generatingKey ? 'Generating...' : 'Generate New API Key'}</span>
        </button>
      </div>

      {/* API Keys Table Section */}
      <div className="dev-api-card">
        <div className="dev-api-card-title">
          <span>Active API Keys</span>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '400' }}>
            ({apiKeys.length} Keys)
          </span>
        </div>

        <div className="dev-api-table-wrapper">
          {loadingKeys ? (
            <div style={{ padding: '20px', textTransform: 'uppercase', color: '#64748b', fontSize: '13px' }}>
              Loading API keys...
            </div>
          ) : apiKeys.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
              <p style={{ margin: 0, fontWeight: 500 }}>No API Keys generated yet.</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Click "Generate New API Key" above to create your first API credentials.</p>
            </div>
          ) : (
            <table className="dev-api-table">
              <thead>
                <tr>
                  <th>API Key</th>
                  <th>Created Date</th>
                  <th>Last Used</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map(k => (
                  <tr key={k.id}>
                    <td>
                      <span className="dev-api-key-code">{k.api_key}</span>
                    </td>
                    <td>{new Date(k.created_at).toLocaleString()}</td>
                    <td>{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}</td>
                    <td>
                      <span className={`badge-status ${k.status}`}>
                        {k.status}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn-action-copy"
                          onClick={() => copyToClipboard(k.api_key, 'API Key')}
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          className="btn-action-delete"
                          onClick={() => handleDeleteKey(k.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Search Documentation */}
      <div className="dev-api-search-container">
        
        <input
          type="text"
          className="dev-api-search-input"
          placeholder="Search API Documentation (e.g. Send WA, OTP, Filter, Report)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* API Accordion List */}
      <div className="accordion-list">
        {filteredApis.length === 0 ? (
          <div className="dev-api-card" style={{ textAlign: 'center', color: '#64748b' }}>
            No API documentation found matching "{searchQuery}".
          </div>
        ) : (
          filteredApis.map((api, index) => {
            const isExpanded = expandedId === api.id
            const themeClass = `accordion-theme-${COLOR_THEMES[index % COLOR_THEMES.length]}`
            const fullEndpointUrl = `${BASE_URL}${api.endpoint}`

            return (
              <div
                key={api.id}
                className={`accordion-item ${themeClass} ${isExpanded ? 'expanded' : ''}`}
              >
                {/* Header */}
                <div className="accordion-header" onClick={() => handleToggleAccordion(api.id)}>
                  <div className="accordion-title-group">
                    <span className="accordion-index">{api.id}.</span>
                    <span className={`method-badge ${api.method.toLowerCase()}`}>{api.method}</span>
                    <span className="accordion-title-text">{api.title}</span>
                    <span className="accordion-endpoint-path">{api.endpoint}</span>
                  </div>
                  <span className="accordion-toggle-icon">▼</span>
                </div>

                {/* Body */}
                {isExpanded && (
                  <div className="accordion-body">
                    {/* Endpoint URL Banner */}
                    <div className="endpoint-banner">
                      <div>
                        <span style={{ color: '#94a3b8', marginRight: '8px' }}>URL:</span>
                        <span className="endpoint-url">{fullEndpointUrl}</span>
                      </div>
                      <button
                        type="button"
                        className="btn-copy-endpoint"
                        onClick={() => copyToClipboard(fullEndpointUrl, 'Endpoint URL')}
                      >
                        Copy Endpoint
                      </button>
                    </div>

                    <p className="api-desc">{api.description}</p>

                    {/* Parameters Table */}
                    {api.params.length > 0 && (
                      <>
                        <div className="section-subtitle">Parameters</div>
                        <table className="params-table">
                          <thead>
                            <tr>
                              <th>Parameter</th>
                              <th>Required</th>
                              <th>Type</th>
                              <th>Description</th>
                              <th>Example</th>
                            </tr>
                          </thead>
                          <tbody>
                            {api.params.map(p => (
                              <tr key={p.name}>
                                <td><code style={{ fontWeight: 600, color: '#1e293b' }}>{p.name}</code></td>
                                <td>
                                  <span className={`req-badge ${p.required.toLowerCase()}`}>
                                    {p.required}
                                  </span>
                                </td>
                                <td>{p.type}</td>
                                <td>{p.desc}</td>
                                <td><code style={{ color: '#0284c7' }}>{p.example}</code></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}

                    {/* Example Request Snippets */}
                    <div className="section-subtitle">Request Code Examples & Snippets</div>
                    <div className="json-box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          className={`btn-copy-json ${(activeSnippetTabs[api.id] || 'json') === 'json' ? 'active-snippet-tab' : ''}`}
                          style={{ background: (activeSnippetTabs[api.id] || 'json') === 'json' ? '#0284c7' : '#334155', color: '#fff' }}
                          onClick={() => setActiveSnippetTabs({ ...activeSnippetTabs, [api.id]: 'json' })}
                        >
                          JSON Body
                        </button>
                        <button
                          type="button"
                          className={`btn-copy-json ${(activeSnippetTabs[api.id] || 'json') === 'curl' ? 'active-snippet-tab' : ''}`}
                          style={{ background: (activeSnippetTabs[api.id] || 'json') === 'curl' ? '#0284c7' : '#334155', color: '#fff' }}
                          onClick={() => setActiveSnippetTabs({ ...activeSnippetTabs, [api.id]: 'curl' })}
                        >
                          cURL
                        </button>
                        <button
                          type="button"
                          className={`btn-copy-json ${(activeSnippetTabs[api.id] || 'json') === 'postman' ? 'active-snippet-tab' : ''}`}
                          style={{ background: (activeSnippetTabs[api.id] || 'json') === 'postman' ? '#0284c7' : '#334155', color: '#fff' }}
                          onClick={() => setActiveSnippetTabs({ ...activeSnippetTabs, [api.id]: 'postman' })}
                        >
                          Postman Collection
                        </button>
                      </div>
                      <button
                        type="button"
                        className="btn-copy-json"
                        onClick={() => {
                          const tab = activeSnippetTabs[api.id] || 'json'
                          const apiKey = apiKeys.length > 0 ? apiKeys[0].api_key : 'YOUR_API_KEY'
                          let contentToCopy = ''
                          if (tab === 'curl') contentToCopy = getCurlExample(api, apiKey)
                          else if (tab === 'postman') contentToCopy = getPostmanExample(api, apiKey)
                          else contentToCopy = JSON.stringify(api.reqExample, null, 2)
                          copyToClipboard(contentToCopy, `${tab.toUpperCase()} Snippet`)
                        }}
                      >
                        Copy Snippet
                      </button>
                    </div>
                    <pre className="json-code-block">
                      {(activeSnippetTabs[api.id] || 'json') === 'curl'
                        ? getCurlExample(api, apiKeys.length > 0 ? apiKeys[0].api_key : 'YOUR_API_KEY')
                        : (activeSnippetTabs[api.id] || 'json') === 'postman'
                        ? getPostmanExample(api, apiKeys.length > 0 ? apiKeys[0].api_key : 'YOUR_API_KEY')
                        : JSON.stringify(api.reqExample, null, 2)}
                    </pre>

                    {/* Example Response */}
                    <div className="section-subtitle">Example Response (200 OK)</div>
                    <div className="json-box-header">
                      <span>JSON Response</span>
                      <button
                        type="button"
                        className="btn-copy-json"
                        onClick={() => copyToClipboard(JSON.stringify(api.resExample, null, 2), 'Response JSON')}
                      >
                        Copy JSON
                      </button>
                    </div>
                    <pre className="json-code-block">
                      {JSON.stringify(api.resExample, null, 2)}
                    </pre>

                    {/* Error Response */}
                    <div className="section-subtitle">Error Response (400 / 401)</div>
                    <div className="json-box-header">
                      <span>JSON Error</span>
                      <button
                        type="button"
                        className="btn-copy-json"
                        onClick={() => copyToClipboard(JSON.stringify(api.errExample, null, 2), 'Error JSON')}
                      >
                        Copy JSON
                      </button>
                    </div>
                    <pre className="json-code-block">
                      {JSON.stringify(api.errExample, null, 2)}
                    </pre>

                    <div style={{ marginTop: '16px', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-test-playground"
                        onClick={() => handleTestInPlayground(api)}
                      >
                        <span>⚡ Try in API Playground</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* BONUS FEATURE: API Playground */}
      <div className="playground-section" ref={playgroundRef}>
        <div className="dev-api-card-title" style={{ color: '#1e3a8a', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          <span>⚡ API Playground - Interactive Live Tester</span>
          <span className="badge-status active">Live Sandbox</span>
        </div>

        <div className="playground-grid">
          {/* Left Column - Request Form */}
          <div>
            <div className="form-group">
              <label>Select API Key for Testing</label>
              <select
                className="form-control-select"
                value={selectedApiKey}
                onChange={(e) => setSelectedApiKey(e.target.value)}
              >
                {apiKeys.length === 0 ? (
                  <option value="">No key selected (uses session token)</option>
                ) : (
                  apiKeys.map(k => (
                    <option key={k.id} value={k.api_key}>
                      {k.api_key} ({k.status})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="form-group">
              <label>Select API Endpoint</label>
              <select
                className="form-control-select"
                value={selectedEndpointId}
                onChange={handlePlaygroundEndpointChange}
              >
                {API_DOCUMENTATION.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.id}. [{a.method}] {a.title} ({a.endpoint})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div className="section-subtitle" style={{ marginTop: 0 }}>Request Parameters</div>
              {currentPlaygroundApi.params.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>This endpoint does not require any parameters.</p>
              ) : (
                currentPlaygroundApi.params.map(p => (
                  <div className="form-group" key={p.name}>
                    <label style={{ fontSize: '12px' }}>
                      {p.name} {p.required === 'Yes' && <span style={{ color: '#ef4444' }}>*</span>}
                    </label>
                    <input
                      type="text"
                      className="form-control-input"
                      value={playgroundParams[p.name] !== undefined ? playgroundParams[p.name] : ''}
                      onChange={(e) => setPlaygroundParams({ ...playgroundParams, [p.name]: e.target.value })}
                      placeholder={p.example}
                    />
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              className="btn-generate-key"
              style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}
              onClick={handleExecutePlayground}
              disabled={playgroundLoading}
            >
              <span>{playgroundLoading ? 'Sending Request...' : '🚀 Send API Request'}</span>
            </button>
          </div>

          {/* Right Column - Live Response Output */}
          <div>
            <div className="form-group">
              <label>Response Preview</label>
              {playgroundResponse ? (
                <div>
                  <div className="response-status-bar">
                    <div>
                      <span>Status: </span>
                      <span className={playgroundResponse.status < 400 ? 'status-badge-200' : 'status-badge-err'}>
                        {playgroundResponse.status} {playgroundResponse.statusText}
                      </span>
                    </div>
                    <div>
                      <span>Time: {playgroundResponse.duration}</span>
                    </div>
                  </div>
                  <pre className="json-code-block" style={{ height: '360px' }}>
                    {JSON.stringify(playgroundResponse.data, null, 2)}
                  </pre>
                </div>
              ) : (
                <div style={{ height: '400px', background: '#0f172a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px' }}>
                  Click "Send API Request" to see live response here...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
