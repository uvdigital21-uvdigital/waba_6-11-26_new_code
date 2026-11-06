import React, { useEffect } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
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
import ChatbotFlowBuilder from './pages/ChatbotFlowBuilder.jsx'
import Followup from './pages/Followup.jsx'
import FollowupForm from './pages/FollowupForm.jsx'
import FollowupDetail from './pages/FollowupDetail.jsx'
import ManageOfficialTemplate from './pages/ManageOfficialTemplate.jsx'
import AddOfficialTemplate from './pages/AddOfficialTemplate.jsx'
import CreateOTPTemplate from './pages/CreateOTPTemplate.jsx'
import ManageOfficialNumbers from './pages/ManageOfficialNumbers.jsx'
import ManageAgent from './pages/ManageAgent.jsx'
import Tags from './pages/Tags.jsx'
import OptOutBlackList from './pages/OptOutBlackList.jsx'
import MetaBillingInsights from './pages/MetaBillingInsights.jsx'
import TeamMembers from './pages/TeamMembers.jsx'
import AgentReport from './pages/AgentReport.jsx'
import CatalogOrders from './pages/CatalogOrders.jsx'
import QrGenerator from './pages/QrGenerator.jsx'
import ManageUser from './pages/ManageUser.jsx'
import Catalog from './pages/Catalog.jsx'
import PostCreator from './pages/PostCreator.jsx'
import AssignCredit from './pages/AssignCredit.jsx'
import DaysBasedUsers from './pages/DaysBasedUsers.jsx'
import RolePermissions from './pages/RolePermissions.jsx'
import ManageCredit from './pages/ManageCredit.jsx'
import CreditHistory from './pages/CreditHistory.jsx'
import CreditLicence from './pages/CreditLicence.jsx'
import DurationLicence from './pages/DurationLicence.jsx'
import VoucherManage from './pages/VoucherManage.jsx'
import ManageReseller from './pages/ManageReseller.jsx'
import NotificationReport from './pages/NotificationReport.jsx'
import ProfileInfo from './pages/ProfileInfo.jsx'
import Support from './pages/Support.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import DeveloperApi from './pages/DeveloperApi.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import TermsAndConditions from './pages/TermsAndConditions.jsx'
import { useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import { checkModuleAccess } from './config/modules.js'
import CoolGlobalLoader from './components/CoolGlobalLoader.jsx'


function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

/**
 * SmartHomeRedirect — decides where to send the user after login:
 * - Non-team-member admins → /dashboard (they always have access)
 * - Team members with dashboard:view → /dashboard
 * - Team members WITHOUT dashboard:view → first allowed route
 */
function SmartHomeRedirect() {
  const { user, hasPermission } = useAuth()
  if (!user) return <Navigate to="/login" replace />

  // Non-team-members (account owners) always land on dashboard
  if (!user.is_team_member) return <Navigate to="/dashboard" replace />

  // Team member: check if they have dashboard access
  if (hasPermission('dashboard:view') || hasPermission('dashboard')) {
    return <Navigate to="/dashboard" replace />
  }

  // Find first permitted route for this team member
  const permittedRoutes = [
    { key: 'chat:inbox',       path: '/chat' },
    { key: 'sendWa:quick',     path: '/send-wa/quick' },
    { key: 'sendWa:csv',       path: '/send-wa/csv' },
    { key: 'sendWa:tags',      path: '/send-wa/tags' },
    { key: 'sendWa:group',     path: '/send-wa/group' },
    { key: 'sendWa:birthday',  path: '/send-wa/birthday' },
    { key: 'reports:history',  path: '/reports/sending-history' },
    { key: 'reports:scheduled',path: '/reports/scheduled-log' },
    { key: 'followup:manage',  path: '/followup' },
    { key: 'template:manage',  path: '/template/manage' },
    { key: 'chatbot:flow',     path: '/chatbot' },
    { key: 'api:developer',    path: '/developer/api' },
    { key: 'catalog:builder',  path: '/catalog' },
    { key: 'setting:numbers',  path: '/setting/manage-numbers' },
    { key: 'setting:billing',  path: '/setting/meta-billing' },
    { key: 'setting:team_members', path: '/settings/team-members' },
  ]

  for (const route of permittedRoutes) {
    if (hasPermission(route.key)) {
      return <Navigate to={route.path} replace />
    }
  }

  // Last resort: show dashboard (will show access denied message itself)
  return <Navigate to="/dashboard" replace />
}

// Layout wrapper for all protected routes.
// ALSO re-checks fresh permissions from the backend on every route
// navigation (not just on full page refresh/F5) — so if an admin removes
// a user's module access while that user is already logged in, the very
// next click/navigation re-fetches permissions and the guards below
// (ModuleRoute / AdminRoute) redirect them away immediately.
function ProtectedLayout() {
  const { user, refreshUser } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (user) {
      refreshUser()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  if (!user) return <Navigate to="/login" replace />
  return <Layout><Outlet /></Layout>
}

// Guard that restricts access strictly to Super Admin & Main Account Owner roles
function AdminRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  const isOwnerAdmin = !user.is_team_member && (user.role === 'Super Admin' || user.role === 'Admin' || user.username === 'admin')
  if (!isOwnerAdmin) {
    return <Navigate to="/dashboard" replace state={{ accessDenied: true, message: 'Administrator access required.' }} />
  }
  return children
}

// Guard that allows Admin OR Reseller roles (Reseller scoping is handled in backend/pages)
function ResellerRoute({ children, module = null, subKey = null }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  const isOwnerAdmin = !user.is_team_member && (user.role === 'Super Admin' || user.role === 'Admin' || user.username === 'admin')
  const isReseller = user.role === 'Reseller'
  if (!isOwnerAdmin && !isReseller) {
    return <Navigate to="/dashboard" replace state={{ accessDenied: true, message: 'Access required.' }} />
  }
  // For Resellers, additionally verify the specific module is in their allowed_modules
  if (isReseller && module) {
    const hasAccess = checkModuleAccess(user.allowed_modules, module, subKey, user.role)
    if (!hasAccess) {
      return <Navigate to="/dashboard" replace state={{ accessDenied: true, message: 'You do not have access to this module.' }} />
    }
  }
  return children
}

// Guard that checks if user has the required module and subKey in allowed_modules or team member permissions
function ModuleRoute({ module, subKey = null, children }) {
  const { user, hasPermission } = useAuth()
  if (!user) return <Navigate to="/login" replace />

  const isOwnerAdmin = !user.is_team_member && (user.role === 'Super Admin' || user.role === 'Admin' || user.username === 'admin')
  if (isOwnerAdmin) return children

  // For Team Members: strictly validate granular permissions
  if (user.is_team_member) {
    const hasPerm = hasPermission(subKey) || hasPermission(module)
    if (!hasPerm) {
      // Use SmartHomeRedirect to avoid infinite loop when /dashboard itself is denied
      return <SmartHomeRedirect />
    }
    return children
  }

  const hasAccess = checkModuleAccess(user.allowed_modules, module, subKey, user.role)
  if (!hasAccess) {
    return <Navigate to="/dashboard" replace state={{ accessDenied: true, module: subKey || module }} />
  }

  return children
}

export default function App() {
  return (
    <>
      <CoolGlobalLoader />
      <Routes>
        {/* Public Legal & Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/PrivacyPolicy" element={<PrivacyPolicy />} />
      <Route path="/privacypolicy" element={<PrivacyPolicy />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/PRIVACY-POLICY" element={<PrivacyPolicy />} />
      <Route path="/PRIVACY%20POLICY" element={<PrivacyPolicy />} />
      <Route path="/PRIVACY POLICY" element={<PrivacyPolicy />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/TermsAndConditions" element={<TermsAndConditions />} />
      <Route path="/termsandconditions" element={<TermsAndConditions />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
      <Route path="/TERMS-AND-CONDITIONS" element={<TermsAndConditions />} />
      <Route path="/TERMS%20AND%20CONDITIONS" element={<TermsAndConditions />} />
      <Route path="/TERMS AND CONDITIONS" element={<TermsAndConditions />} />
      <Route path="/terms" element={<TermsAndConditions />} />

      {/* Protected Routes with shared Layout */}
      <Route path="/" element={<ProtectedLayout />}>
        <Route index element={<SmartHomeRedirect />} />
        <Route path="dashboard" element={<ModuleRoute module="dashboard" subKey="dashboard:view"><Dashboard /></ModuleRoute>} />
        <Route path="chat" element={<ModuleRoute module="chat" subKey="chat:inbox"><Chat /></ModuleRoute>} />
        <Route path="chatbot" element={<ModuleRoute module="chatbot" subKey="chatbot:flow"><Chatbot /></ModuleRoute>} />
        <Route path="chatbot/flow" element={<ModuleRoute module="chatbot" subKey="chatbot:flow"><ChatbotFlow /></ModuleRoute>} />
        <Route path="chatbot/flow/:id" element={<ModuleRoute module="chatbot" subKey="chatbot:flow"><ChatbotFlowBuilder /></ModuleRoute>} />
        <Route path="followup" element={<ModuleRoute module="followup" subKey="followup:manage"><Followup /></ModuleRoute>} />
        <Route path="followup/new" element={<ModuleRoute module="followup" subKey="followup:manage"><FollowupForm /></ModuleRoute>} />
        <Route path="followup/create" element={<ModuleRoute module="followup" subKey="followup:manage"><FollowupForm /></ModuleRoute>} />
        <Route path="followup/:id/edit" element={<ModuleRoute module="followup" subKey="followup:manage"><FollowupForm /></ModuleRoute>} />
        <Route path="followup/:id" element={<ModuleRoute module="followup" subKey="followup:manage"><FollowupDetail /></ModuleRoute>} />
        <Route path="reports" element={<ModuleRoute module="reports"><Reports /></ModuleRoute>} />
        <Route path="reports/sending-history" element={<ModuleRoute module="reports" subKey="reports:history"><SendingHistory /></ModuleRoute>} />
        <Route path="reports/scheduled-log" element={<ModuleRoute module="reports" subKey="reports:scheduled"><ScheduledLog /></ModuleRoute>} />
        <Route path="reports/ads-referral" element={<ModuleRoute module="reports"><AdsReferralReport /></ModuleRoute>} />
        <Route path="reports/tagging-numbers" element={<ModuleRoute module="reports"><TaggingNumbers /></ModuleRoute>} />
        <Route path="reports/whatsapp-forms" element={<ModuleRoute module="reports"><WhatsappForms /></ModuleRoute>} />
        <Route path="reports/whatsapp-forms/create" element={<ModuleRoute module="reports"><CreateWappForm /></ModuleRoute>} />
        <Route path="reports/flow-template-responses" element={<ModuleRoute module="reports"><FlowTemplateResponses /></ModuleRoute>} />
        <Route path="reports/whatsapp-forms/responses" element={<ModuleRoute module="reports"><WappFormResponses /></ModuleRoute>} />
        <Route path="send-wa/quick" element={<ModuleRoute module="sendWa" subKey="sendWa:quick"><SendQuick /></ModuleRoute>} />
        <Route path="send-wa/csv" element={<ModuleRoute module="sendWa" subKey="sendWa:csv"><SendCsv /></ModuleRoute>} />
        <Route path="send-wa/tags" element={<ModuleRoute module="sendWa" subKey="sendWa:tags"><SendByTags /></ModuleRoute>} />
        <Route path="send-wa/group" element={<ModuleRoute module="sendWa" subKey="sendWa:group"><SendByGroup /></ModuleRoute>} />
        <Route path="send-wa/birthday" element={<ModuleRoute module="sendWa" subKey="sendWa:birthday"><SendBirthday /></ModuleRoute>} />
        <Route path="template/manage" element={<ModuleRoute module="template" subKey="template:manage"><ManageOfficialTemplate /></ModuleRoute>} />
        <Route path="template/manage/add" element={<ModuleRoute module="template" subKey="template:manage"><AddOfficialTemplate /></ModuleRoute>} />
        <Route path="template/manage/edit/:id" element={<ModuleRoute module="template" subKey="template:manage"><AddOfficialTemplate /></ModuleRoute>} />
        <Route path="template/manage/add/otp" element={<ModuleRoute module="template" subKey="template:manage"><CreateOTPTemplate /></ModuleRoute>} />
        <Route path="template/create" element={<ModuleRoute module="template" subKey="template:manage"><Placeholder title="Create Template" /></ModuleRoute>} />
        <Route path="template/categories" element={<ModuleRoute module="template" subKey="template:manage"><Placeholder title="Template Categories" /></ModuleRoute>} />
        <Route path="setting/manage-numbers" element={<ModuleRoute module="setting" subKey="setting:numbers"><ManageOfficialNumbers /></ModuleRoute>} />
        <Route path="setting/optout-blacklist" element={<ModuleRoute module="setting" subKey="setting:blacklist"><OptOutBlackList /></ModuleRoute>} />
        <Route path="setting/tags" element={<AdminRoute><Tags /></AdminRoute>} />
        <Route path="setting/meta-billing" element={<ModuleRoute module="setting" subKey="setting:billing"><MetaBillingInsights /></ModuleRoute>} />
        <Route path="settings/team-members" element={<ModuleRoute module="setting" subKey="setting:team_members"><TeamMembers /></ModuleRoute>} />
        <Route path="setting/team-members" element={<ModuleRoute module="setting" subKey="setting:team_members"><TeamMembers /></ModuleRoute>} />
        <Route path="setting/manage-agent" element={<ModuleRoute module="setting"><ManageAgent /></ModuleRoute>} />
        <Route path="setting/agent-report" element={<ModuleRoute module="setting"><AgentReport /></ModuleRoute>} />
        <Route path="setting/catalog-orders" element={<ModuleRoute module="setting"><CatalogOrders /></ModuleRoute>} />
        <Route path="setting/qr-generator" element={<ModuleRoute module="setting"><QrGenerator /></ModuleRoute>} />
        <Route path="setting/general" element={<ModuleRoute module="setting"><Placeholder title="General Settings" /></ModuleRoute>} />
        <Route path="setting/api" element={<ModuleRoute module="setting"><Placeholder title="API Settings" /></ModuleRoute>} />
        <Route path="setting/keys" element={<ModuleRoute module="setting"><Placeholder title="Keys" /></ModuleRoute>} />
        <Route path="setting/profile" element={<ModuleRoute module="setting"><Placeholder title="Profile" /></ModuleRoute>} />
        <Route path="developer/api" element={<ModuleRoute module="api" subKey="api:developer"><DeveloperApi /></ModuleRoute>} />
        <Route path="api" element={<Navigate to="/developer/api" replace />} />
        <Route path="reseller" element={<Placeholder title="Reseller" />} />
        <Route path="reseller/manage-user" element={<ResellerRoute module="reseller" subKey="reseller:users"><ManageUser /></ResellerRoute>} />
        <Route path="manage-users" element={<ResellerRoute module="reseller" subKey="reseller:users"><ManageUser /></ResellerRoute>} />
        <Route path="manage-user" element={<ResellerRoute module="reseller" subKey="reseller:users"><ManageUser /></ResellerRoute>} />
        <Route path="reseller/assign-credit" element={<ResellerRoute module="reseller" subKey="reseller:credit"><AssignCredit /></ResellerRoute>} />
        <Route path="assign-credit" element={<ResellerRoute module="reseller" subKey="reseller:credit"><AssignCredit /></ResellerRoute>} />
        <Route path="reseller/days-based-users" element={<ResellerRoute module="reseller" subKey="reseller:days_users"><DaysBasedUsers /></ResellerRoute>} />
        <Route path="days-based-users" element={<ResellerRoute module="reseller" subKey="reseller:days_users"><DaysBasedUsers /></ResellerRoute>} />
        <Route path="reseller/manage-resellers" element={<AdminRoute><ManageReseller /></AdminRoute>} />
        <Route path="manage-resellers" element={<AdminRoute><ManageReseller /></AdminRoute>} />
        <Route path="reseller/permissions" element={<RolePermissions />} />
        <Route path="reseller/manage-credit" element={<ManageCredit />} />
        <Route path="reseller/credit-history" element={<CreditHistory />} />
        <Route path="reseller/credit-licence" element={<CreditLicence />} />
        <Route path="reseller/duration-licence" element={<DurationLicence />} />
        <Route path="reseller/voucher-manage" element={<VoucherManage />} />
        <Route path="notification-report" element={<NotificationReport />} />
        <Route path="profile-info" element={<ProfileInfo />} />
        <Route path="support" element={<Support />} />
        <Route path="change-password" element={<ChangePassword />} />
        <Route path="catalog" element={<ModuleRoute module="catalog" subKey="catalog:builder"><Catalog /></ModuleRoute>} />
        <Route path="post-creator" element={<ModuleRoute module="post_creator" subKey="post_creator:editor"><PostCreator /></ModuleRoute>} />
      </Route>

      <Route path="*" element={<SmartHomeRedirect />} />
    </Routes>
    </>
  )
}
