import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Placeholder from './pages/Placeholder.jsx'
import SendQuick from './pages/SendQuick.jsx'
import SendCsv from './pages/SendCsv.jsx'
import SendByTags from './pages/SendByTags.jsx'
import SendByGroup from './pages/SendByGroup.jsx'
import SendBirthday from './pages/SendBirthday.jsx'
import SendingHistory from './pages/SendingHistory.jsx'
import ScheduledLog from './pages/ScheduledLog.jsx'
import AdsReferralReport from './pages/AdsReferralReport.jsx'
import TaggingNumbers from './pages/TaggingNumbers.jsx'
import WhatsappForms from './pages/WhatsappForms.jsx'
import CreateWappForm from './pages/CreateWappForm.jsx'
import FlowTemplateResponses from './pages/FlowTemplateResponses.jsx'
import WappFormResponses from './pages/WappFormResponses.jsx'
import Reports from './pages/Reports.jsx'
import Chat from './pages/Chat.jsx'
import Chatbot from './pages/Chatbot.jsx'
import ChatbotFlow from './pages/ChatbotFlow.jsx'
import ManageOfficialTemplate from './pages/ManageOfficialTemplate.jsx'
import AddOfficialTemplate from './pages/AddOfficialTemplate.jsx'
import CreateOTPTemplate from './pages/CreateOTPTemplate.jsx'
import ManageOfficialNumbers from './pages/ManageOfficialNumbers.jsx'
import { useAuth } from './context/AuthContext.jsx'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

const OTHER_SECTIONS = [
  { path: '/reports', title: 'Reports' },
  { path: '/chatbot', title: 'ChatBot' },
  { path: '/api', title: 'API' },
  { path: '/template', title: 'Template' },

  { path: '/reseller', title: 'Reseller' },
]

const SEND_WA_ROUTES = [
  { path: '/send-wa/quick', element: <SendQuick /> },
  { path: '/send-wa/csv', element: <SendCsv /> },
  { path: '/send-wa/tags', element: <SendByTags /> },
  { path: '/send-wa/group', element: <SendByGroup /> },
  { path: '/send-wa/birthday', element: <SendBirthday /> },
]

const REPORTS_ROUTES = [
  { path: '/reports', element: <Reports /> },
  { path: '/reports/sending-history', element: <SendingHistory /> },
  { path: '/reports/scheduled-log', element: <ScheduledLog /> },
  { path: '/reports/ads-referral', element: <AdsReferralReport /> },
  { path: '/reports/tagging-numbers', element: <TaggingNumbers /> },
  { path: '/reports/whatsapp-forms', element: <WhatsappForms /> },
  { path: '/reports/whatsapp-forms/create', element: <CreateWappForm /> },
  { path: '/reports/flow-template-responses', element: <FlowTemplateResponses /> },
  { path: '/reports/whatsapp-forms/responses', element: <WappFormResponses /> },
]

const TEMPLATE_ROUTES = [
  { path: '/template/manage', element: <ManageOfficialTemplate /> },
  { path: '/template/manage/add', element: <AddOfficialTemplate /> },
  { path: '/template/manage/add/otp', element: <CreateOTPTemplate /> },
  { path: '/template/create', element: <Placeholder title="Create Template" /> },
  { path: '/template/categories', element: <Placeholder title="Template Categories" /> },
]

const SETTING_ROUTES = [
  { path: '/setting/manage-numbers', element: <ManageOfficialNumbers /> },
  { path: '/setting/general', element: <Placeholder title="General Settings" /> },
  { path: '/setting/api', element: <Placeholder title="API Settings" /> },
  { path: '/setting/keys', element: <Placeholder title="Keys" /> },
  { path: '/setting/profile', element: <Placeholder title="Profile" /> },
]

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chatbot"
        element={
          <ProtectedRoute>
            <Chatbot />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chatbot/flow"
        element={
          <ProtectedRoute>
            <ChatbotFlow />
          </ProtectedRoute>
        }
      />
      {OTHER_SECTIONS.map(({ path, title }) => (
        <Route
          key={path}
          path={path}
          element={
            <ProtectedRoute>
              <Placeholder title={title} />
            </ProtectedRoute>
          }
        />
      ))}
      {SEND_WA_ROUTES.map(({ path, element }) => (
        <Route
          key={path}
          path={path}
          element={
            <ProtectedRoute>
              {element}
            </ProtectedRoute>
          }
        />
      ))}
      {REPORTS_ROUTES.map(({ path, element }) => (
        <Route
          key={path}
          path={path}
          element={
            <ProtectedRoute>
              {element}
            </ProtectedRoute>
          }
        />
      ))}
      {TEMPLATE_ROUTES.map(({ path, element }) => (
        <Route
          key={path}
          path={path}
          element={
            <ProtectedRoute>
              {element}
            </ProtectedRoute>
          }
        />
      ))}
      {SETTING_ROUTES.map(({ path, element }) => (
        <Route
          key={path}
          path={path}
          element={
            <ProtectedRoute>
              {element}
            </ProtectedRoute>
          }
        />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
