import { useEffect, useState, useRef } from 'react';
import {
  SendIcon,
  MicIcon,
  PlusIcon,
  MoonIcon,
  SunIcon,
  MenuIcon,
  CloseIcon,
  TrashIcon,
  EditIcon,
  GoogleIcon,
  SettingsIcon,
  ProfileIcon,
  PinIcon,
  PinOffIcon,
  FavoriteIcon,
  BrainIcon,
} from './components/icons';
import type { PlanConfig, SubscriptionInfo } from './services/subscriptionService';

interface ToolInfo {
  name: string;
  input: string;
  output: string;
  type: 'text' | 'html' | 'image' | 'json' | 'chart';
}

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  file?: {
    file_id: string;
    filename: string;
    file_type: string;
    file_size: number;
  };
  sources?: {
    title: string;
    url: string;
    timestamp: string;
  }[];
  used_sources?: {
    id: string;
    title: string;
    type: string;
    created_at: string;
  }[];
  image_url?: string;
  agent?: string;
  tool_info?: ToolInfo;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  pinned?: boolean;
  favorite?: boolean;
  updated_at?: string;
}



interface User {
  id: string;
  name: string;
  email: string;
  token: string;
  avatar?: string;
  google_linked?: boolean;
  username?: string;
  bio?: string;
  phone?: string;
  country?: string;
  language?: string;
  timezone?: string;
  account_type?: string;
  member_since?: string;
  role?: string;
  subscription_details?: any;
}




const getThemeClasses = (theme: string) => {
  switch(theme) {
    case 'emerald':
      return {
        primary: 'bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-emerald-600/10',
        text: 'text-emerald-600 dark:text-emerald-450',
        border: 'border-emerald-500 dark:border-emerald-800',
        ring: 'focus:ring-emerald-500 focus:border-emerald-500',
        gradient: 'from-emerald-500 to-teal-500',
        avatarBg: 'from-emerald-500 to-teal-500',
        highlight: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
        activeItem: 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30'
      };
    case 'amber':
      return {
        primary: 'bg-amber-600 hover:bg-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500 shadow-amber-600/10',
        text: 'text-amber-650 dark:text-amber-450',
        border: 'border-amber-500 dark:border-amber-800',
        ring: 'focus:ring-amber-500 focus:border-amber-500',
        gradient: 'from-amber-500 to-orange-500',
        avatarBg: 'from-amber-500 to-orange-500',
        highlight: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
        activeItem: 'bg-amber-50 dark:bg-amber-950/30 border border-amber-500/30'
      };
    case 'slate':
      return {
        primary: 'bg-slate-700 hover:bg-slate-650 dark:bg-slate-700 dark:hover:bg-slate-650 shadow-slate-700/10',
        text: 'text-slate-700 dark:text-slate-400',
        border: 'border-slate-500 dark:border-slate-800',
        ring: 'focus:ring-slate-500 focus:border-slate-500',
        gradient: 'from-slate-650 to-slate-550',
        avatarBg: 'from-slate-650 to-slate-550',
        highlight: 'bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400',
        activeItem: 'bg-slate-50 dark:bg-slate-950/30 border border-slate-500/30'
      };
    default: // indigo
      return {
        primary: 'bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 shadow-indigo-600/10',
        text: 'text-indigo-600 dark:text-indigo-400',
        border: 'border-indigo-500 dark:border-indigo-800',
        ring: 'focus:ring-indigo-500 focus:border-indigo-500',
        gradient: 'from-indigo-500 to-violet-500',
        avatarBg: 'from-indigo-500 to-violet-500',
        highlight: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400',
        activeItem: 'bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-500/30'
      };
  }
};



const getInitials = (name?: string): string => {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const getChatIdFromPath = (rawPath: string): string => {
  if (typeof window === 'undefined') return '';
  const clean = rawPath.toLowerCase().replace(/\/$/, '') || '/';
  const parts = clean.split('/').filter(Boolean);
  if (parts.length >= 2 && (parts[0] === 'chat' || parts[0] === 'c')) {
    return parts[1];
  }
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('chat_id') || urlParams.get('id') || '';
};

const resolveRouteState = (rawPath: string) => {
  const path = rawPath.toLowerCase().replace(/\/$/, '') || '/';
  let tab: 'chat' | 'notes' | 'tasks' | 'reminders' | 'documents' | 'automation' | 'notifications' | 'admin' | 'pricing' = 'chat';
  let profile = false;
  let settings = false;
  let help = false;
  let addAccount = false;
  let adminSection = 'dashboard';
  let isUnknownAdminRoute = false;

  if (path.startsWith('/chat') || path.startsWith('/c/')) {
    tab = 'chat';
  } else if (path === '/profile') {
    profile = true;
    const saved = localStorage.getItem('mega_assistant_active_tab') as any;
    if (['notes', 'tasks', 'reminders', 'documents', 'automation', 'notifications', 'admin', 'pricing'].includes(saved)) {
      tab = saved;
    }
  } else if (path === '/settings') {
    settings = true;
    const saved = localStorage.getItem('mega_assistant_active_tab') as any;
    if (['notes', 'tasks', 'reminders', 'documents', 'automation', 'notifications', 'admin', 'pricing'].includes(saved)) {
      tab = saved;
    }
  } else if (path === '/help') {
    help = true;
    const saved = localStorage.getItem('mega_assistant_active_tab') as any;
    if (['notes', 'tasks', 'reminders', 'documents', 'automation', 'notifications', 'admin', 'pricing'].includes(saved)) {
      tab = saved;
    }
  } else if (path === '/accounts/add' || path === '/add-account' || path === '/accounts') {
    addAccount = true;
    const saved = localStorage.getItem('mega_assistant_active_tab') as any;
    if (['notes', 'tasks', 'reminders', 'documents', 'automation', 'notifications', 'admin', 'pricing'].includes(saved)) {
      tab = saved;
    }
  } else if (path === '/pricing' || path === '/subscription') {
    tab = 'pricing';
  } else if (path === '/notes') {
    tab = 'notes';
  } else if (path === '/tasks') {
    tab = 'tasks';
  } else if (path === '/reminders') {
    tab = 'reminders';
  } else if (path === '/documents') {
    tab = 'documents';
  } else if (path === '/automation') {
    tab = 'automation';
  } else if (path === '/notifications') {
    tab = 'notifications';
  } else if (path === '/admin' || path.startsWith('/admin/')) {
    tab = 'admin';
    if (path === '/admin' || path === '/admin/dashboard') {
      adminSection = 'dashboard';
    } else if (path === '/admin/users') {
      adminSection = 'users';
    } else if (path === '/admin/ai-usage' || path === '/admin/usage') {
      adminSection = 'usage';
    } else if (path === '/admin/subscription') {
      adminSection = 'subscription';
    } else if (path === '/admin/announcements') {
      adminSection = 'announcements';
    } else if (path === '/admin/files' || path === '/admin/storage') {
      adminSection = 'storage';
    } else if (path === '/admin/settings' || path === '/admin/system-settings') {
      adminSection = 'settings';
    } else if (path === '/admin/audit-logs' || path === '/admin/logs') {
      adminSection = 'logs';
    } else if (path === '/admin/errors') {
      adminSection = 'errors';
    } else if (path === '/admin/security') {
      adminSection = 'security';
    } else {
      adminSection = 'dashboard';
      isUnknownAdminRoute = true;
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/admin');
      }
    }
  } else {
    tab = 'chat';
  }

  return { tab, profile, settings, help, addAccount, adminSection, isUnknownAdminRoute };
};

export default function App() {
  // Theme & Layout state
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('mega_theme_mode') as any) || 'system';
  });
  const [isDark, setIsDark] = useState<boolean>(() => {
    const mode = localStorage.getItem('mega_theme_mode') || 'system';
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('mega_sidebar_open');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [productivityExpanded, setProductivityExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('mega_productivity_expanded');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [pinnedExpanded, setPinnedExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('mega_pinned_expanded');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [recentChatsExpanded, setRecentChatsExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('mega_recent_chats_expanded');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const toggleProductivity = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProductivityExpanded(prev => {
      const next = !prev;
      localStorage.setItem('mega_productivity_expanded', JSON.stringify(next));
      return next;
    });
  };

  const togglePinned = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPinnedExpanded(prev => {
      const next = !prev;
      localStorage.setItem('mega_pinned_expanded', JSON.stringify(next));
      return next;
    });
  };

  const toggleRecentChats = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRecentChatsExpanded(prev => {
      const next = !prev;
      localStorage.setItem('mega_recent_chats_expanded', JSON.stringify(next));
      return next;
    });
  };
  const [profileMenuOpen, setProfileMenuOpen] = useState<boolean>(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [useFrontCameraMode, setUseFrontCameraMode] = useState<boolean>(true);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(() => resolveRouteState(window.location.pathname).help);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [voiceStatusText, setVoiceStatusText] = useState<string>("Listening... Speak now");
  const [isVoiceResponseEnabled] = useState<boolean>(true);
  const [shouldSpeakNext, setShouldSpeakNext] = useState<boolean>(false);

  // Profile & Settings Dialog states
  const [showProfileDialog, setShowProfileDialog] = useState<boolean>(() => resolveRouteState(window.location.pathname).profile);
  const [showSettingsDialog, setShowSettingsDialog] = useState<boolean>(() => resolveRouteState(window.location.pathname).settings);
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [previousTab, setPreviousTab] = useState<'chat' | 'notes' | 'tasks' | 'reminders' | 'documents' | 'automation' | 'notifications' | 'admin' | 'pricing'>('chat');
  const [notifSearchQuery, setNotifSearchQuery] = useState<string>('');
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread' | 'system' | 'ai'>('all');

  // Theme & Language settings preferences
  const [themePref, setThemePref] = useState<'indigo' | 'emerald' | 'amber' | 'slate'>(() => {
    return (localStorage.getItem('mega_theme_pref') as any) || 'indigo';
  });
  const [languagePref, setLanguagePref] = useState<'en' | 'es' | 'fr' | 'de'>(() => {
    return (localStorage.getItem('mega_language_pref') as any) || 'en';
  });

  // Profile Edit & Detailed states
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [editProfileName, setEditProfileName] = useState<string>('');
  const [editProfileAvatar, setEditProfileAvatar] = useState<string>('');
  const [editProfileUsername, setEditProfileUsername] = useState<string>('');
  const [editProfileBio, setEditProfileBio] = useState<string>('');
  const [editProfilePhone, setEditProfilePhone] = useState<string>('');
  const [editProfileCountry, setEditProfileCountry] = useState<string>('');
  const [editProfileLanguage, setEditProfileLanguage] = useState<string>('');
  const [editProfileTimezone, setEditProfileTimezone] = useState<string>('');
  
  // Username live check states
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState<boolean>(false);

  // Settings Tabs
  const [activeSettingsTab, setActiveSettingsTab] = useState<'appearance' | 'notifications' | 'security' | 'privacy' | 'memory'>('appearance');

  // Notifications Preferences (9 categories)
  const [notifReminders, setNotifReminders] = useState<boolean>(() => localStorage.getItem('mega_notif_reminders') !== 'false');
  const [notifTasks, setNotifTasks] = useState<boolean>(() => localStorage.getItem('mega_notif_tasks') !== 'false');
  const [notifAutomation, setNotifAutomation] = useState<boolean>(() => localStorage.getItem('mega_notif_automation') !== 'false');
  const [notifDocsFiles, setNotifDocsFiles] = useState<boolean>(() => localStorage.getItem('mega_notif_docs_files') !== 'false');
  const [notifImageGen, setNotifImageGen] = useState<boolean>(() => localStorage.getItem('mega_notif_image_gen') !== 'false');
  const [notifBackgroundAI, setNotifBackgroundAI] = useState<boolean>(() => localStorage.getItem('mega_notif_background_ai') !== 'false');
  const [notifAccountSecurity, setNotifAccountSecurity] = useState<boolean>(() => localStorage.getItem('mega_notif_account_security') !== 'false');
  const [notifPlanBilling, setNotifPlanBilling] = useState<boolean>(() => localStorage.getItem('mega_notif_plan_billing') !== 'false');
  const [notifAssistantUpdates, setNotifAssistantUpdates] = useState<boolean>(() => localStorage.getItem('mega_notif_assistant_updates') !== 'false');

  // Multi-account Support
  const [accounts, setAccounts] = useState<User[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('mega_accounts') || '[]');
    } catch {
      return [];
    }
  });
  const [showAddAccountDialog, setShowAddAccountDialog] = useState<boolean>(() => resolveRouteState(window.location.pathname).addAccount);
  const [addAccountEmail, setAddAccountEmail] = useState<string>('');
  const [addAccountPassword, setAddAccountPassword] = useState<string>('');
  const [addAccountError, setAddAccountError] = useState<string | null>(null);
  const [addAccountLoading, setAddAccountLoading] = useState<boolean>(false);

  // Password Management Security Subform
  const [secCurrentPassword, setSecCurrentPassword] = useState<string>('');
  const [secNewPassword, setSecNewPassword] = useState<string>('');
  const [secConfirmPassword, setSecConfirmPassword] = useState<string>('');
  const [secError, setSecError] = useState<string | null>(null);
  const [secSuccess, setSecSuccess] = useState<string | null>(null);
  const [secLoading, setSecLoading] = useState<boolean>(false);

  // Profile Picture Cropping Submodal
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState<number>(1);
  const [cropOffsetX, setCropOffsetX] = useState<number>(0);
  const [cropOffsetY, setCropOffsetY] = useState<number>(0);
  const [isDraggingCrop, setIsDraggingCrop] = useState<boolean>(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Mock Google Authentication Overlay state
  const [showGoogleConsent, setShowGoogleConsent] = useState<boolean>(false);

  // AI Memories state
  interface MemoryItem {
    id: string;
    content: string;
    created_at: string;
  }
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [newMemoryContent, setNewMemoryContent] = useState<string>('');

  // Chat search & sorting states
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [webSearchEnabled, setWebSearchEnabled] = useState<boolean>(false);
  const [imageGenEnabled, setImageGenEnabled] = useState<boolean>(false);

  // File Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{
    file_id: string;
    filename: string;
    file_type: string;
    file_size: number;
  } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // User Authentication state
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('mega_chat_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  // Productivity Assistant states
  interface Note {
    id: string;
    user_id: string;
    title: string;
    content: string;
    pinned: boolean;
    created_at: string;
    updated_at: string;
  }
  interface Task {
    id: string;
    user_id: string;
    title: string;
    priority: 'low' | 'medium' | 'high';
    completed: boolean;
    created_at: string;
  }
  interface Reminder {
    id: string;
    user_id: string;
    title: string;
    description?: string;
    datetime: string;
    repeat_type: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom';
    priority: 'low' | 'medium' | 'high';
    status: 'upcoming' | 'completed' | 'missed';
    completed: boolean;
    created_at: string;
    updated_at: string;
  }
  interface DocumentItem {
    id: string;
    user_id: string;
    title: string;
    content: string;
    type: string;
    created_at: string;
    updated_at: string;
  }
  interface WorkflowAction {
    type: string;
    params: Record<string, any>;
  }
  interface Workflow {
    id: string;
    user_id: string;
    name: string;
    trigger_type: string;
    trigger_detail: string;
    actions: WorkflowAction[];
    enabled: boolean;
    created_at: string;
    updated_at: string;
  }
  interface WorkflowHistory {
    id: string;
    workflow_id: string;
    workflow_name: string;
    status: string;
    trigger: string;
    executed_at: string;
    details: string;
  }
  interface NotificationItem {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: string;
    status: string;
    created_at: string;
    related_module?: string;
    priority?: string;
  }

  const [activeTab, setActiveTab] = useState<'chat' | 'notes' | 'tasks' | 'reminders' | 'documents' | 'automation' | 'notifications' | 'admin' | 'pricing'>(() => resolveRouteState(window.location.pathname).tab);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);

  const getAdminSectionUrl = (secId: string): string => {
    switch (secId) {
      case 'users': return '/admin/users';
      case 'usage': return '/admin/ai-usage';
      case 'subscription': return '/admin/subscription';
      case 'announcements': return '/admin/announcements';
      case 'storage': return '/admin/files';
      case 'settings': return '/admin/settings';
      case 'logs': return '/admin/audit-logs';
      case 'errors': return '/admin/errors';
      case 'security': return '/admin/security';
      case 'dashboard':
      default:
        return '/admin';
    }
  };

  const navigateToRoute = (targetPath: string, options?: { replace?: boolean }) => {
    const normalized = targetPath.toLowerCase().replace(/\/$/, '') || '/';
    if (options?.replace) {
      window.history.replaceState({}, '', normalized);
    } else if (window.location.pathname !== normalized) {
      window.history.pushState({}, '', normalized);
    }

    const { tab, profile, settings, help, addAccount, adminSection, isUnknownAdminRoute } = resolveRouteState(normalized);
    setActiveTab(tab);
    if (tab === 'admin' && adminSection) {
      setActiveAdminSection(adminSection);
      if (isUnknownAdminRoute) {
        window.history.replaceState({}, '', '/admin');
      }
    }
    setShowProfileDialog(profile);
    setShowSettingsDialog(settings);
    setShowHelpModal(help);
    setShowAddAccountDialog(addAccount);
    if (!profile && !settings && !help && !addAccount) {
      localStorage.setItem('mega_assistant_active_tab', tab);
    }
  };

  const handleAdminSectionChange = (secId: string) => {
    setActiveAdminSection(secId);
    const targetUrl = getAdminSectionUrl(secId);
    if (window.location.pathname !== targetUrl) {
      window.history.pushState({}, '', targetUrl);
    }
  };

  const closeRouteDialog = (type: 'profile' | 'settings' | 'help' | 'addAccount') => {
    if (type === 'profile') setShowProfileDialog(false);
    if (type === 'settings') setShowSettingsDialog(false);
    if (type === 'help') setShowHelpModal(false);
    if (type === 'addAccount') setShowAddAccountDialog(false);

    const current = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';
    if (['/profile', '/settings', '/help', '/accounts/add', '/add-account', '/accounts'].includes(current)) {
      const target = activeTab === 'chat' ? '/' : `/${activeTab}`;
      window.history.pushState({}, '', target);
    }
  };

  // Admin Panel states
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [systemErrors, setSystemErrors] = useState<any[]>([]);
  const [adminSettings, setAdminSettings] = useState<any>(null);
  const [activeAdminSection, setActiveAdminSection] = useState<string>(() => resolveRouteState(window.location.pathname).adminSection || 'dashboard');
  const [userUsage, setUserUsage] = useState<any>(null);
  
  // Announcement states
  const [announcementTitle, setAnnouncementTitle] = useState<string>('');
  const [announcementMessage, setAnnouncementMessage] = useState<string>('');
  const [announcementPriority, setAnnouncementPriority] = useState<string>('normal');
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState<boolean>(false);
  const [announcementSuccess, setAnnouncementSuccess] = useState<string | null>(null);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);

  // Settings update states
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  // Admin Subscription Management states
  const [adminSubConfig, setAdminSubConfig] = useState<any>(null);
  const [isSavingSubConfig, setIsSavingSubConfig] = useState<boolean>(false);
  const [subConfigSuccess, setSubConfigSuccess] = useState<string | null>(null);
  const [subConfigError, setSubConfigError] = useState<string | null>(null);
  const [newFeatureText, setNewFeatureText] = useState<string>("");
  const [editingFeatureIndex, setEditingFeatureIndex] = useState<number | null>(null);
  const [editingFeatureText, setEditingFeatureText] = useState<string>("");
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [deleteConfirmSessionId, setDeleteConfirmSessionId] = useState<string | null>(null);

  const [notes, setNotes] = useState<Note[]>([]);
  const subscriptionHistory: any[] = [];
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowHistory[]>([]);

  const [notesLoading, setNotesLoading] = useState<boolean>(true);
  const [tasksLoading, setTasksLoading] = useState<boolean>(true);
  const [remindersLoading, setRemindersLoading] = useState<boolean>(true);
  const [documentsLoading, setDocumentsLoading] = useState<boolean>(true);
  const [workflowsLoading, setWorkflowsLoading] = useState<boolean>(true);
  const [activeAutomationSubTab, setActiveAutomationSubTab] = useState<'my_workflows' | 'history'>('my_workflows');
  const [automationNLInput, setAutomationNLInput] = useState<string>('');
  const [isParsingWorkflow, setIsParsingWorkflow] = useState<boolean>(false);
  const [isExecutingWorkflowId, setIsExecutingWorkflowId] = useState<string | null>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState<boolean>(false);
  const [wfFormName, setWfFormName] = useState<string>('');
  const [wfFormTriggerType, setWfFormTriggerType] = useState<string>('schedule');
  const [wfFormTriggerDetail, setWfFormTriggerDetail] = useState<string>('');
  const [wfFormActions, setWfFormActions] = useState<WorkflowAction[]>([]);
  const [notificationsList, setNotificationsList] = useState<NotificationItem[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);

  // Subscription states
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<PlanConfig | null>(null);
  const [checkoutPromoActive, setCheckoutPromoActive] = useState<boolean>(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'upi' | 'card' | 'netbanking' | null>('card');
  const [cardNumber, setCardNumber] = useState<string>('');
  const [cardExpiry, setCardExpiry] = useState<string>('');
  const [cardCvc, setCardCvc] = useState<string>('');
  const [cardName, setCardName] = useState<string>('');
  const [savePaymentDetails, setSavePaymentDetails] = useState<boolean>(false);
  const [checkoutProcessing, setCheckoutProcessing] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<boolean>(false);
  const [demoProgress, setDemoProgress] = useState<string | null>(null);
  const [simulateFailure, setSimulateFailure] = useState<boolean>(false);
  const plusCardRef = useRef<HTMLDivElement>(null);

  // Document states
  const [activeDocument, setActiveDocument] = useState<DocumentItem | null>(() => {
    const savedDocId = localStorage.getItem('mega_assistant_active_doc_id');
    if (savedDocId) {
      const unsavedContent = localStorage.getItem(`mega_assistant_unsaved_content_${savedDocId}`) || '';
      const unsavedTitle = localStorage.getItem(`mega_assistant_unsaved_title_${savedDocId}`) || 'Untitled Document';
      const unsavedType = localStorage.getItem(`mega_assistant_unsaved_type_${savedDocId}`) || 'resume';
      return {
        id: savedDocId,
        user_id: '',
        title: unsavedTitle,
        content: unsavedContent,
        type: unsavedType,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    return null;
  });
  const [selectedDocType, setSelectedDocType] = useState<string>(() => {
    const savedDocId = localStorage.getItem('mega_assistant_active_doc_id');
    if (savedDocId) {
      return localStorage.getItem(`mega_assistant_unsaved_type_${savedDocId}`) || 'resume';
    }
    return localStorage.getItem('mega_assistant_selected_doc_type') || 'resume';
  });
  const [docPromptInput, setDocPromptInput] = useState<string>('');
  const [isGeneratingDoc, setIsGeneratingDoc] = useState<boolean>(false);
  const [docTitleInput, setDocTitleInput] = useState<string>(() => {
    const savedDocId = localStorage.getItem('mega_assistant_active_doc_id');
    if (savedDocId) {
      return localStorage.getItem(`mega_assistant_unsaved_title_${savedDocId}`) || '';
    }
    return '';
  });
  const [docContentInput, setDocContentInput] = useState<string>(() => {
    const savedDocId = localStorage.getItem('mega_assistant_active_doc_id');
    if (savedDocId) {
      return localStorage.getItem(`mega_assistant_unsaved_content_${savedDocId}`) || '';
    }
    return '';
  });
  const [isEditingDoc, setIsEditingDoc] = useState<boolean>(false);
  const [refineActionActive, setRefineActionActive] = useState<boolean>(false);
  const [targetRewriteTone, setTargetRewriteTone] = useState<string>(() => {
    return localStorage.getItem('mega_assistant_target_rewrite_tone') || 'professional';
  });
  const [customToneInstruction, setCustomToneInstruction] = useState<string>(() => {
    return localStorage.getItem('mega_assistant_custom_tone_instruction') || '';
  });
  const [isRewritingDoc, setIsRewritingDoc] = useState<boolean>(false);
  const [sourceTranslateLang, setSourceTranslateLang] = useState<string>(() => {
    return localStorage.getItem('mega_assistant_source_translate_lang') || 'auto';
  });
  const [targetTranslateLang, setTargetTranslateLang] = useState<string>(() => {
    return localStorage.getItem('mega_assistant_target_translate_lang') || 'Spanish';
  });
  const [isTranslatingDoc, setIsTranslatingDoc] = useState<boolean>(false);
  const [docSearchQuery, setDocSearchQuery] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Productivity Search / Form Input states
  const [noteSearchQuery, setNoteSearchQuery] = useState<string>('');
  
  // Note Form
  const [noteFormOpen, setNoteFormOpen] = useState<boolean>(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteTitleInput, setNoteTitleInput] = useState<string>('');
  const [noteContentInput, setNoteContentInput] = useState<string>('');

  // Task Form
  const [taskTitleInput, setTaskTitleInput] = useState<string>('');
  const [taskPriorityInput, setTaskPriorityInput] = useState<'low' | 'medium' | 'high'>('medium');

  // Reminder Form
  const [reminderTitleInput, setReminderTitleInput] = useState<string>('');
  const [reminderDescriptionInput, setReminderDescriptionInput] = useState<string>('');
  const [reminderDateTimeInput, setReminderDateTimeInput] = useState<string>('');
  const [reminderRepeatTypeInput, setReminderRepeatTypeInput] = useState<'once' | 'daily' | 'weekly' | 'monthly' | 'custom'>('once');
  const [reminderPriorityInput, setReminderPriorityInput] = useState<'low' | 'medium' | 'high'>('medium');
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  const [authView, setAuthView] = useState<'login' | 'signup' | 'forgot'>('login');

  // Auth Inputs
  const [authName, setAuthName] = useState<string>('');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Active Chat Session state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const urlId = getChatIdFromPath(window.location.pathname);
      if (urlId) return urlId;
      const saved = localStorage.getItem('mega_assistant_active_chat_id');
      if (saved) return saved;
    }
    return '';
  });

  const selectChatSession = (id: string, replaceUrl: boolean = false) => {
    if (!id) return;
    setActiveSessionId(id);
    localStorage.setItem('mega_assistant_active_chat_id', id);
    const targetUrl = `/chat/${id}`;
    if (window.location.pathname !== targetUrl) {
      if (replaceUrl) {
        window.history.replaceState({}, '', targetUrl);
      } else {
        window.history.pushState({}, '', targetUrl);
      }
    }
  };

  // Rename Session states
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState<string>('');
  const [activeMenuSessionId, setActiveMenuSessionId] = useState<string | null>(null);
  const [sharingSession, setSharingSession] = useState<ChatSession | null>(null);

  // Chat Action States (Copy, Share, Edit, Like, Dislike)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [likedMessages, setLikedMessages] = useState<Record<string, string | undefined>>({});

  // Input & backend integration state
  const [inputValue, setInputValue] = useState<string>('');
  const [backendStatus, setBackendStatus] = useState<'connected' | 'connecting' | 'failed'>('connecting');
  const [latency, setLatency] = useState<number | null>(null);
  const [isTyping, setIsTyping] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollToBottomRef = useRef<boolean>(false);

  const saveChatScrollPosition = (sessionId: string, scrollTop: number) => {
    if (!sessionId) return;
    try {
      sessionStorage.setItem(`mega_chat_scroll_${sessionId}`, scrollTop.toString());
    } catch (e) {}
  };

  const getSavedChatScrollPosition = (sessionId: string): number | null => {
    if (!sessionId) return null;
    try {
      const val = sessionStorage.getItem(`mega_chat_scroll_${sessionId}`);
      return val !== null ? parseFloat(val) : null;
    } catch (e) {
      return null;
    }
  };

  const handleChatScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (activeSessionId) {
      saveChatScrollPosition(activeSessionId, target.scrollTop);
    }
  };

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photosInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const plusMenuRef = useRef<HTMLDivElement | null>(null);
  const cameraModalRef = useRef<HTMLDivElement | null>(null);
  const helpModalRef = useRef<HTMLDivElement | null>(null);
  const profileDialogRef = useRef<HTMLDivElement | null>(null);
  const settingsDialogRef = useRef<HTMLDivElement | null>(null);
  const addAccountDialogRef = useRef<HTMLDivElement | null>(null);
  const googleConsentDialogRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const sidebarTriggerRef = useRef<HTMLButtonElement | null>(null);
  const deleteConfirmDialogRef = useRef<HTMLDivElement | null>(null);
  const workspaceContentRef = useRef<HTMLDivElement | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Global click-outside-to-close behavior
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;


      // 2. Profile Menu
      if (profileMenuOpen && profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
      // 3. Plus Menu
      if (plusMenuOpen && plusMenuRef.current && !plusMenuRef.current.contains(target)) {
        setPlusMenuOpen(false);
      }
      // 4. Camera Modal
      if (isCameraActive && cameraModalRef.current && !cameraModalRef.current.contains(target)) {
        closeCamera();
      }

      // 6. Help Modal
      if (showHelpModal && helpModalRef.current && !helpModalRef.current.contains(target)) {
        closeRouteDialog('help');
      }
      // 7. Profile Dialog
      if (showProfileDialog && profileDialogRef.current && !profileDialogRef.current.contains(target)) {
        closeRouteDialog('profile');
      }
      // 8. Settings Dialog
      if (showSettingsDialog && settingsDialogRef.current && !settingsDialogRef.current.contains(target)) {
        closeRouteDialog('settings');
      }
      // 9. Add Account Dialog
      if (showAddAccountDialog && addAccountDialogRef.current && !addAccountDialogRef.current.contains(target)) {
        closeRouteDialog('addAccount');
      }
      // 10. Google Consent Dialog
      if (showGoogleConsent && googleConsentDialogRef.current && !googleConsentDialogRef.current.contains(target)) {
        setShowGoogleConsent(false);
      }
      // 11. Sidebar click-away closure behavior (mobile only)
      const path = e.composedPath ? e.composedPath() : [];

      const isBackgroundClick = 
        target === workspaceContentRef.current || 
        (target.classList && (
          target.classList.contains('overflow-y-auto') || 
          target.classList.contains('max-w-4xl')
        )) ||
        target.tagName === 'MAIN';

      const clickInsideWorkspace = 
        (sidebarRef.current && (sidebarRef.current.contains(target) || path.includes(sidebarRef.current))) ||
        (sidebarTriggerRef.current && (sidebarTriggerRef.current.contains(target) || path.includes(sidebarTriggerRef.current))) ||
        (workspaceContentRef.current && 
         (workspaceContentRef.current.contains(target) || path.includes(workspaceContentRef.current)) && 
         !isBackgroundClick);

      if (window.innerWidth < 768 && sidebarOpen && !clickInsideWorkspace) {
        setSidebarOpen(false);
      }
      // 12. Delete Confirmation modal click outside
      if (
        deleteConfirmSessionId &&
        deleteConfirmDialogRef.current &&
        !deleteConfirmDialogRef.current.contains(target)
      ) {
        setDeleteConfirmSessionId(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCameraActive) {
          closeCamera();

        } else if (showHelpModal) {
          closeRouteDialog('help');
        } else if (showProfileDialog) {
          closeRouteDialog('profile');
        } else if (showSettingsDialog) {
          closeRouteDialog('settings');
        } else if (showAddAccountDialog) {
          closeRouteDialog('addAccount');
        } else if (showGoogleConsent) {
          setShowGoogleConsent(false);
        } else if (plusMenuOpen) {
          setPlusMenuOpen(false);

        } else if (profileMenuOpen) {
          setProfileMenuOpen(false);
        } else if (deleteConfirmSessionId) {
          setDeleteConfirmSessionId(null);
        } else if (sidebarOpen) {
          setSidebarOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    profileMenuOpen,
    plusMenuOpen,
    isCameraActive,
    showHelpModal,
    showProfileDialog,
    showSettingsDialog,
    showAddAccountDialog,
    showGoogleConsent,
    sidebarOpen,
    cameraStream,
    deleteConfirmSessionId,
    activeTab
  ]);

  // Centralized Background Scroll Lock Hook
  const isAnyOverlayActive = Boolean(
    showCheckoutModal ||
    showProfileDialog ||
    showSettingsDialog ||
    showHelpModal ||
    showAddAccountDialog ||
    showGoogleConsent ||
    showPreviewModal ||
    isCameraActive ||
    deleteConfirmSessionId !== null ||
    noteFormOpen ||
    editingNote !== null ||
    editingReminder !== null ||
    editingWorkflow !== null ||
    (typeof window !== 'undefined' && window.innerWidth < 768 && sidebarOpen)
  );

  useEffect(() => {
    if (isAnyOverlayActive) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      const prevDocOverflow = document.documentElement.style.overflow;
      const prevBodyOverflow = document.body.style.overflow;
      const prevBodyTouchAction = document.body.style.touchAction;
      const prevBodyPaddingRight = document.body.style.paddingRight;

      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }

      return () => {
        document.documentElement.style.overflow = prevDocOverflow;
        document.body.style.overflow = prevBodyOverflow;
        document.body.style.touchAction = prevBodyTouchAction;
        document.body.style.paddingRight = prevBodyPaddingRight;
      };
    }
  }, [isAnyOverlayActive]);

  // Toggle Theme Class on Root
  useEffect(() => {
    localStorage.setItem('mega_theme_mode', themeMode);
    const applyTheme = () => {
      let dark = false;
      if (themeMode === 'dark') {
        dark = true;
      } else if (themeMode === 'light') {
        dark = false;
      } else {
        dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      setIsDark(dark);
      if (dark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    applyTheme();

    if (themeMode === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [themeMode]);

  // Listen for browser navigation (back/forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const { tab, profile, settings, help, addAccount, adminSection, isUnknownAdminRoute } = resolveRouteState(window.location.pathname);
      setActiveTab(tab);

      const urlChatId = getChatIdFromPath(window.location.pathname);
      if (urlChatId) {
        setActiveSessionId(urlChatId);
        localStorage.setItem('mega_assistant_active_chat_id', urlChatId);
      }

      if (tab === 'admin' && adminSection) {
        setActiveAdminSection(adminSection);
        if (isUnknownAdminRoute) {
          window.history.replaceState({}, '', '/admin');
        }
      }
      setShowProfileDialog(profile);
      setShowSettingsDialog(settings);
      setShowHelpModal(help);
      setShowAddAccountDialog(addAccount);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch FastAPI Health Status
  useEffect(() => {
    const checkHealth = () => {
      const startTime = performance.now();
      fetch(`${apiUrl}/api/health`)
        .then((res) => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then(() => {
          const endTime = performance.now();
          setLatency(Math.round(endTime - startTime));
          setBackendStatus('connected');
        })
        .catch(() => {
          setBackendStatus('failed');
          setLatency(null);
        });
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, [apiUrl]);

  const fetchChats = () => {
    if (!user || !user.token) return;
    fetch(`${apiUrl}/api/chats`, {
      headers: {
        'Authorization': `Bearer ${user.token}`
      }
    })
      .then((res) => {
        if (res.status === 401) {
          handleLogout();
          throw new Error("Session expired.");
        }
        return res.json();
      })
      .then((data: any[]) => {
        const parsedChats: ChatSession[] = data.map((chat) => ({
          ...chat,
          messages: chat.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
        if (parsedChats.length > 0) {
          setSessions(parsedChats);
          
          const urlId = getChatIdFromPath(window.location.pathname);
          const savedId = localStorage.getItem('mega_assistant_active_chat_id') || '';
          const preferredId = urlId || savedId || activeSessionId;

          const matchedSession = parsedChats.find(
            (c) => c.id.toLowerCase() === preferredId.toLowerCase()
          );

          if (matchedSession) {
            setActiveSessionId(matchedSession.id);
            localStorage.setItem('mega_assistant_active_chat_id', matchedSession.id);
            if (urlId || window.location.pathname === '/' || window.location.pathname.startsWith('/chat')) {
              window.history.replaceState({}, '', `/chat/${matchedSession.id}`);
            }
          } else {
            const fallbackChat = parsedChats[0];
            setActiveSessionId(fallbackChat.id);
            localStorage.setItem('mega_assistant_active_chat_id', fallbackChat.id);
            if (window.location.pathname.startsWith('/chat')) {
              window.history.replaceState({}, '', `/chat/${fallbackChat.id}`);
            }
          }
        } else {
          // Initialize fresh conversation if database is empty
          fetch(`${apiUrl}/api/chats`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({ title: 'New Chat' })
          })
            .then((res) => res.json())
            .then((newChat: any) => {
              const defaultChat: ChatSession = {
                ...newChat,
                messages: []
              };
              setSessions([defaultChat]);
              setActiveSessionId(defaultChat.id);
              localStorage.setItem('mega_assistant_active_chat_id', defaultChat.id);
              window.history.replaceState({}, '', `/chat/${defaultChat.id}`);
            });
        }

        // Load memories
        fetch(`${apiUrl}/api/memories`, {
          headers: {
            'Authorization': `Bearer ${user.token}`
          }
        })
          .then((res) => res.json())
          .then((memData) => {
            if (Array.isArray(memData)) {
              setMemories(memData);
            }
          })
          .catch((err) => console.error("Failed to load memories:", err));
      })
      .catch((err) => console.error("Failed to load chat history:", err));
  };

  const fetchNotes = () => {
    if (!user || !user.token) {
      setNotes([]);
      setNotesLoading(false);
      return;
    }
    setNotesLoading(true);
    fetch(`${apiUrl}/api/notes`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setNotes(list);
        setNotesLoading(false);
      })
      .catch(e => {
        console.error("Failed to load notes:", e);
        setNotesLoading(false);
      });
  };

  const fetchTasks = () => {
    if (!user || !user.token) {
      setTasks([]);
      setTasksLoading(false);
      return;
    }
    setTasksLoading(true);
    fetch(`${apiUrl}/api/tasks`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setTasks(list);
        setTasksLoading(false);
      })
      .catch(e => {
        console.error("Failed to load tasks:", e);
        setTasksLoading(false);
      });
  };

  const fetchReminders = () => {
    if (!user || !user.token) {
      setReminders([]);
      setRemindersLoading(false);
      return;
    }
    setRemindersLoading(true);
    fetch(`${apiUrl}/api/reminders`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setReminders(list);
        setRemindersLoading(false);
      })
      .catch(e => {
        console.error("Failed to load reminders:", e);
        setRemindersLoading(false);
      });
  };

  const fetchDocuments = () => {
    if (!user || !user.token) {
      setDocuments([]);
      setDocumentsLoading(false);
      return;
    }
    setDocumentsLoading(true);
    fetch(`${apiUrl}/api/documents`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => {
        const docs = Array.isArray(data) ? data : [];
        setDocuments(docs);
        setDocumentsLoading(false);
        
        const savedDocId = localStorage.getItem('mega_assistant_active_doc_id');
        if (savedDocId && savedDocId !== 'new' && docs.length > 0) {
          const found = docs.find((d: any) => d.id === savedDocId);
          if (found) {
            setActiveDocument(found);
            const unsavedContent = localStorage.getItem(`mega_assistant_unsaved_content_${savedDocId}`);
            if (unsavedContent !== null) {
              setDocContentInput(unsavedContent);
            } else {
              setDocContentInput(found.content);
            }
            const unsavedTitle = localStorage.getItem(`mega_assistant_unsaved_title_${savedDocId}`);
            if (unsavedTitle !== null) {
              setDocTitleInput(unsavedTitle);
            } else {
              setDocTitleInput(found.title);
            }
          }
        }
      })
      .catch(e => {
        console.error("Failed to load documents:", e);
        setDocumentsLoading(false);
      });
  };

  const fetchWorkflows = () => {
    if (!user || !user.token) {
      setWorkflows([]);
      setWorkflowsLoading(false);
      return;
    }
    setWorkflowsLoading(true);
    fetch(`${apiUrl}/api/workflows`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => {
        const list = data || [];
        setWorkflows(list);
        setWorkflowsLoading(false);
      })
      .catch(e => {
        console.error("Failed to load workflows:", e);
        setWorkflowsLoading(false);
      });

    fetch(`${apiUrl}/api/workflows/history`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => setWorkflowHistory(data || []))
      .catch(e => console.error("Failed to load workflow history:", e));
  };

  const fetchProductivityData = () => {
    fetchNotes();
    fetchTasks();
    fetchReminders();
    fetchDocuments();
    fetchWorkflows();
  };

  // Load data on mount / tab switch based on activeTab
  useEffect(() => {
    if (!user || !user.token) return;

    // Always fetch chats on user authentication / mount so chats remain loaded across all tabs
    fetchChats();

    if (activeTab === 'notes') {
      fetchNotes();
    } else if (activeTab === 'tasks') {
      fetchTasks();
    } else if (activeTab === 'reminders') {
      fetchReminders();
    } else if (activeTab === 'documents') {
      fetchDocuments();
    } else if (activeTab === 'automation') {
      fetchWorkflows();
    }
  }, [activeTab, user?.id, user?.token, apiUrl]);

  // Synchronize state changes to localStorage
  useEffect(() => {
    if (activeTab !== 'notifications') {
      setPreviousTab(activeTab);
    }
    localStorage.setItem('mega_assistant_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('mega_assistant_selected_doc_type', selectedDocType);
  }, [selectedDocType]);

  useEffect(() => {
    localStorage.setItem('mega_assistant_target_rewrite_tone', targetRewriteTone);
  }, [targetRewriteTone]);

  useEffect(() => {
    localStorage.setItem('mega_assistant_custom_tone_instruction', customToneInstruction);
  }, [customToneInstruction]);

  useEffect(() => {
    localStorage.setItem('mega_assistant_source_translate_lang', sourceTranslateLang);
  }, [sourceTranslateLang]);

  useEffect(() => {
    localStorage.setItem('mega_assistant_target_translate_lang', targetTranslateLang);
  }, [targetTranslateLang]);

  useEffect(() => {
    if (activeDocument) {
      localStorage.setItem('mega_assistant_active_doc_id', activeDocument.id);
      localStorage.setItem(`mega_assistant_unsaved_content_${activeDocument.id}`, docContentInput);
      localStorage.setItem(`mega_assistant_unsaved_title_${activeDocument.id}`, docTitleInput);
      if (activeDocument.id === 'new') {
        localStorage.setItem('mega_assistant_unsaved_type_new', selectedDocType);
      }
    } else {
      localStorage.removeItem('mega_assistant_active_doc_id');
    }
  }, [activeDocument, docContentInput, docTitleInput, selectedDocType]);

  // Synchronize accounts list and active user
  useEffect(() => {
    if (user) {
      setAccounts(prev => {
        const exists = prev.some(a => a.id === user.id);
        const updatedUser = { ...user };
        
        let nextList = prev;
        if (!exists) {
          nextList = [...prev, updatedUser];
        } else {
          nextList = prev.map(a => a.id === user.id ? { ...a, ...updatedUser } : a);
        }
        localStorage.setItem('mega_accounts', JSON.stringify(nextList));
        return nextList;
      });
    }
  }, [user]);

  const fetchProfile = () => {
    if (user && user.token) {
      return fetch(`${apiUrl}/api/user/profile`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error("Profile fetch failed");
        })
        .then(data => {
          setUser(prev => {
            if (!prev) return null;
            let hasChanged = false;
            for (const key in data) {
              if ((prev as any)[key] !== data[key]) {
                hasChanged = true;
                break;
              }
            }
            if (!hasChanged) return prev;
            const merged = { ...prev, ...data };
            localStorage.setItem('mega_chat_user', JSON.stringify(merged));
            return merged;
          });
        })
        .catch(err => console.error("Error loading user profile:", err));
    }
    return Promise.resolve();
  };

  // Sync profile from backend on load/switch
  useEffect(() => {
    fetchProfile();
  }, [user?.id, user?.token, apiUrl]);

  // URL routing / hash change listener for /admin protection
  useEffect(() => {
    const handleUrlRouting = () => {
      const pathname = window.location.pathname.toLowerCase();
      const isUrlAdmin = pathname.startsWith('/admin') || 
                         window.location.hash.startsWith('#/admin') || 
                         window.location.hash.startsWith('#admin');
      
      if (isUrlAdmin) {
        if (!user) {
          setAccessDenied(false);
          return;
        }
        if (user.role === 'admin') {
          setActiveTab('admin');
          const { adminSection, isUnknownAdminRoute } = resolveRouteState(window.location.pathname);
          setActiveAdminSection(adminSection);
          if (isUnknownAdminRoute) {
            window.history.replaceState({}, '', '/admin');
          }
          setAccessDenied(false);
        } else {
          setAccessDenied(true);
        }
      } else {
        setAccessDenied(false);
      }
    };

    handleUrlRouting();
    window.addEventListener('popstate', handleUrlRouting);
    window.addEventListener('hashchange', handleUrlRouting);
    
    return () => {
      window.removeEventListener('popstate', handleUrlRouting);
      window.removeEventListener('hashchange', handleUrlRouting);
    };
  }, [user, user?.role]);

  // Fetch admin dashboard details
  const fetchAdminStats = () => {
    if (!user || user.role !== 'admin') return;
    fetch(`${apiUrl}/api/admin/stats`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => setAdminStats(data))
      .catch(err => console.error("Error fetching admin stats:", err));
  };

  const fetchAdminUsers = () => {
    if (!user || user.role !== 'admin') return;
    fetch(`${apiUrl}/api/admin/users`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => setAdminUsers(data))
      .catch(err => console.error("Error fetching admin users:", err));
  };

  const fetchAuditLogs = () => {
    if (!user || user.role !== 'admin') return;
    fetch(`${apiUrl}/api/admin/audit-logs`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => setAuditLogs(data))
      .catch(err => console.error("Error fetching audit logs:", err));
  };

  const fetchSystemErrors = () => {
    if (!user || user.role !== 'admin') return;
    fetch(`${apiUrl}/api/admin/errors`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => setSystemErrors(data))
      .catch(err => console.error("Error fetching system errors:", err));
  };

  const fetchAdminSettings = () => {
    if (!user || user.role !== 'admin') return;
    fetch(`${apiUrl}/api/admin/settings`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => setAdminSettings(data))
      .catch(err => console.error("Error fetching admin settings:", err));
  };

  const fetchAdminSubConfig = () => {
    if (!user || user.role !== 'admin') return;
    fetch(`${apiUrl}/api/admin/subscription/config`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => setAdminSubConfig(data))
      .catch(err => console.error("Error fetching admin subscription config:", err));
  };




  useEffect(() => {
    if (activeTab === 'admin' && user?.role === 'admin') {
      fetchAdminStats();
      fetchAdminUsers();
      fetchAuditLogs();
      fetchSystemErrors();
      fetchAdminSettings();
      fetchAdminSubConfig();
    }
  }, [activeTab, user?.id, user?.role]);

  const fetchUserUsage = () => {
    if (!user) return;
    fetch(`${apiUrl}/api/user/usage`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => {
        if (!res.ok) return;
        return res.json();
      })
      .then(data => {
        if (data) setUserUsage(data);
      })
      .catch(err => console.error("Error fetching user usage:", err));
  };

  const syncNotifs = () => {
    if (!user) return;
    fetch(`${apiUrl}/api/notifications`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(notifsData => {
        const notifs = notifsData || [];
        setNotificationsList(notifs);
        setUnreadNotificationCount(notifs.filter((n: any) => n.status === 'unread').length);
      })
      .catch(e => console.error("Sync notifications failed:", e));
  };

  const fetchSubscription = (token: string) => {
    fetch(`${apiUrl}/api/subscription/current`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        setSubscription(data);
        syncNotifs();
        if (user && data.current_plan && user.account_type?.toLowerCase() !== data.current_plan.toLowerCase()) {
          const updatedUser = { ...user, account_type: data.current_plan.toUpperCase() };
          setUser(updatedUser);
          localStorage.setItem('mega_chat_user', JSON.stringify(updatedUser));
        }
      })
      .catch(err => console.error("Error fetching subscription:", err));
  };

  const handleCancelSubscription = () => {
    if (!user) return;
    if (!confirm("Are you sure you want to cancel your Plus subscription? You will retain access until the end of your billing cycle.")) return;
    fetch(`${apiUrl}/api/subscription/cancel`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          fetchSubscription(user.token);
          syncNotifs();
        } else {
          alert(data.detail || "Failed to cancel subscription.");
        }
      })
      .catch(err => console.error("Error cancelling subscription:", err));
  };

  const handleReactivateSubscription = () => {
    if (!user) return;
    fetch(`${apiUrl}/api/subscription/reactivate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          fetchSubscription(user.token);
          syncNotifs();
        } else {
          alert(data.detail || "Failed to reactivate subscription.");
        }
      })
      .catch(err => console.error("Error reactivating subscription:", err));
  };

  const fetchPlans = () => {
    fetch(`${apiUrl}/api/subscription/plans`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => setPlans(data))
      .catch(err => console.error("Error fetching plans:", err));
  };

  useEffect(() => {
    if (user) {
      fetchUserUsage();
      fetchPlans();
      fetchSubscription(user.token);
      const interval = setInterval(() => {
        fetchUserUsage();
        fetchSubscription(user.token);
      }, 20000);
      return () => clearInterval(interval);
    } else {
      setUserUsage(null);
      setSubscription(null);
    }
  }, [user?.id]);

  useEffect(() => {
    if (userUsage) {
      console.debug("User usage metrics loaded:", userUsage);
    }
  }, [userUsage]);

  useEffect(() => {
    if (showCheckoutModal) {
      const originalStyleOverflow = document.body.style.overflow;
      const originalStyleHeight = document.body.style.height;
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100%';
      
      return () => {
        document.body.style.overflow = originalStyleOverflow;
        document.body.style.height = originalStyleHeight;
      };
    }
  }, [showCheckoutModal]);

  // Load & Sync Notification Preferences
  const fetchNotificationPreferences = () => {
    if (!user) return;
    fetch(`${apiUrl}/api/notifications/preferences`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') {
          if (data.reminders !== undefined) {
            setNotifReminders(data.reminders);
            localStorage.setItem('mega_notif_reminders', String(data.reminders));
          }
          if (data.tasks !== undefined) {
            setNotifTasks(data.tasks);
            localStorage.setItem('mega_notif_tasks', String(data.tasks));
          }
          if (data.automation !== undefined) {
            setNotifAutomation(data.automation);
            localStorage.setItem('mega_notif_automation', String(data.automation));
          }
          if (data.documents_files !== undefined) {
            setNotifDocsFiles(data.documents_files);
            localStorage.setItem('mega_notif_docs_files', String(data.documents_files));
          }
          if (data.image_gen !== undefined) {
            setNotifImageGen(data.image_gen);
            localStorage.setItem('mega_notif_image_gen', String(data.image_gen));
          }
          if (data.background_ai !== undefined) {
            setNotifBackgroundAI(data.background_ai);
            localStorage.setItem('mega_notif_background_ai', String(data.background_ai));
          }
          if (data.account_security !== undefined) {
            setNotifAccountSecurity(data.account_security);
            localStorage.setItem('mega_notif_account_security', String(data.account_security));
          }
          if (data.plan_billing !== undefined) {
            setNotifPlanBilling(data.plan_billing);
            localStorage.setItem('mega_notif_plan_billing', String(data.plan_billing));
          }
          if (data.assistant_updates !== undefined) {
            setNotifAssistantUpdates(data.assistant_updates);
            localStorage.setItem('mega_notif_assistant_updates', String(data.assistant_updates));
          }
        }
      })
      .catch(e => console.error("Failed to load notification preferences:", e));
  };

  const updateBackendPreferences = (newPrefs: any) => {
    if (!user) return;
    fetch(`${apiUrl}/api/notifications/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify(newPrefs)
    })
      .catch(err => console.error("Failed to sync notification preferences to backend:", err));
  };

  const handleTogglePref = (category: string, currentValue: boolean, setter: (val: boolean) => void) => {
    const newValue = !currentValue;
    setter(newValue);
    localStorage.setItem(`mega_notif_${category}`, String(newValue));
    
    const updatedPrefs = {
      reminders: category === 'reminders' ? newValue : notifReminders,
      tasks: category === 'tasks' ? newValue : notifTasks,
      automation: category === 'automation' ? newValue : notifAutomation,
      documents_files: category === 'docs_files' ? newValue : notifDocsFiles,
      image_gen: category === 'image_gen' ? newValue : notifImageGen,
      background_ai: category === 'background_ai' ? newValue : notifBackgroundAI,
      account_security: category === 'account_security' ? newValue : notifAccountSecurity,
      plan_billing: category === 'plan_billing' ? newValue : notifPlanBilling,
      assistant_updates: category === 'assistant_updates' ? newValue : notifAssistantUpdates,
    };
    updateBackendPreferences(updatedPrefs);
  };

  useEffect(() => {
    if (!user) return;
    fetchNotificationPreferences();
  }, [user?.id, user?.token, apiUrl]);

  // Notes CRUD helpers
  const handleSaveNote = () => {
    if (!user || !noteTitleInput.trim()) return;
    const noteData = {
      title: noteTitleInput,
      content: noteContentInput,
      pinned: editingNote ? editingNote.pinned : false
    };

    if (editingNote) {
      fetch(`${apiUrl}/api/notes/${editingNote.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(noteData)
      })
        .then(res => {
          if (!res.ok) throw new Error("Failed to update note");
          return res.json();
        })
        .then(data => {
          setNotes(prev => prev.map(n => n.id === data.id ? data : n));
          setNoteFormOpen(false);
          setEditingNote(null);
          setNoteTitleInput('');
          setNoteContentInput('');
        })
        .catch(err => {
          console.error(err);
          alert(err.message || "Failed to update note. Please try again.");
        });
    } else {
      fetch(`${apiUrl}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(noteData)
      })
        .then(res => {
          if (!res.ok) throw new Error("Failed to save note");
          return res.json();
        })
        .then(data => {
          setNotes(prev => [data, ...prev]);
          setNoteFormOpen(false);
          setNoteTitleInput('');
          setNoteContentInput('');
        })
        .catch(err => {
          console.error(err);
          alert(err.message || "Failed to save note. Please try again.");
        });
    }
  };

  const handleTogglePinNote = (note: Note) => {
    if (!user) return;
    const noteData = {
      title: note.title,
      content: note.content,
      pinned: !note.pinned
    };
    fetch(`${apiUrl}/api/notes/${note.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify(noteData)
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to toggle pin");
        return res.json();
      })
      .then(data => {
        setNotes(prev => prev.map(n => n.id === data.id ? data : n));
      })
      .catch(err => {
        console.error(err);
        alert("Failed to toggle pin state of the note.");
      });
  };

  const handleDeleteNote = (noteId: string) => {
    if (!user) return;
    fetch(`${apiUrl}/api/notes/${noteId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to delete note");
        setNotes(prev => prev.filter(n => n.id !== noteId));
      })
      .catch(err => {
        console.error(err);
        alert("Failed to delete the note. Please try again.");
      });
  };

  // Tasks CRUD helpers
  const handleCreateTask = () => {
    if (!user || !taskTitleInput.trim()) return;
    const taskData = {
      title: taskTitleInput,
      priority: taskPriorityInput,
      completed: false
    };
    fetch(`${apiUrl}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify(taskData)
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to create task");
        return res.json();
      })
      .then(data => {
        setTasks(prev => [data, ...prev]);
        setTaskTitleInput('');
        setTaskPriorityInput('medium');
        fetch(`${apiUrl}/api/notifications`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        })
          .then(res => res.json())
          .then(notifsData => {
            const notifs = notifsData || [];
            setNotificationsList(notifs);
            setUnreadNotificationCount(notifs.filter((n: any) => n.status === 'unread').length);
          })
          .catch(e => console.error("Failed to refresh notifications after task creation:", e));
      })
      .catch(err => {
        console.error(err);
        alert(err.message || "Failed to create task. Please try again.");
      });
  };

  const handleToggleCompleteTask = (task: Task) => {
    if (!user) return;
    const taskData = {
      title: task.title,
      priority: task.priority,
      completed: !task.completed
    };
    fetch(`${apiUrl}/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify(taskData)
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to update task status");
        return res.json();
      })
      .then(data => {
        setTasks(prev => prev.map(t => t.id === data.id ? data : t));
      })
      .catch(err => {
        console.error(err);
        alert("Failed to update task completion state.");
      });
  };

  const handleDeleteTask = (taskId: string) => {
    if (!user) return;
    fetch(`${apiUrl}/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to delete task");
        setTasks(prev => prev.filter(t => t.id !== taskId));
      })
      .catch(err => {
        console.error(err);
        alert("Failed to delete the task. Please try again.");
      });
  };

  // Reminders CRUD helpers
  const handleCreateReminder = () => {
    if (!user || !reminderTitleInput.trim() || !reminderDateTimeInput) return;
    const reminderData = {
      title: reminderTitleInput,
      description: reminderDescriptionInput,
      datetime: (() => {
        const d = new Date(reminderDateTimeInput);
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
      })(),
      repeat_type: reminderRepeatTypeInput,
      priority: reminderPriorityInput,
      status: 'upcoming',
      completed: false
    };

    const isEdit = !!editingReminder;
    const url = isEdit ? `${apiUrl}/api/reminders/${editingReminder.id}` : `${apiUrl}/api/reminders`;
    const method = isEdit ? 'PUT' : 'POST';

    fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify(reminderData)
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(errData => {
            throw new Error(errData.detail || "Failed to schedule reminder");
          });
        }
        return res.json();
      })
      .then(data => {
        if (isEdit) {
          setReminders(prev => prev.map(r => r.id === data.id ? data : r));
          setEditingReminder(null);
        } else {
          setReminders(prev => [data, ...prev]);
        }
        setReminderTitleInput('');
        setReminderDescriptionInput('');
        setReminderDateTimeInput('');
        setReminderRepeatTypeInput('once');
        setReminderPriorityInput('medium');
        
        fetch(`${apiUrl}/api/notifications`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        })
          .then(res => res.json())
          .then(notifsData => {
            const notifs = notifsData || [];
            setNotificationsList(notifs);
            setUnreadNotificationCount(notifs.filter((n: any) => n.status === 'unread').length);
          })
          .catch(e => console.error(e));
      })
      .catch(err => {
        alert(err.message);
      });
  };

  const handleToggleCompleteReminder = (reminder: Reminder) => {
    if (!user) return;
    const isCompleted = !reminder.completed;
    const reminderData = {
      title: reminder.title,
      description: reminder.description || '',
      datetime: reminder.datetime,
      repeat_type: reminder.repeat_type,
      priority: reminder.priority,
      status: isCompleted ? 'completed' : 'upcoming',
      completed: isCompleted
    };
    fetch(`${apiUrl}/api/reminders/${reminder.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify(reminderData)
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to update reminder status");
        return res.json();
      })
      .then(data => {
        setReminders(prev => prev.map(r => r.id === data.id ? data : r));
      })
      .catch(err => {
        console.error(err);
        alert("Failed to update reminder completion state.");
      });
  };

  const handleSnoozeReminder = (reminder: Reminder, minutes: number = 5) => {
    if (!user) return;
    const snoozeTime = new Date(new Date(reminder.datetime).getTime() + minutes * 60000);
    const reminderData = {
      title: reminder.title,
      description: reminder.description || '',
      datetime: (() => {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${snoozeTime.getFullYear()}-${pad(snoozeTime.getMonth() + 1)}-${pad(snoozeTime.getDate())}T${pad(snoozeTime.getHours())}:${pad(snoozeTime.getMinutes())}:00`;
      })(),
      repeat_type: reminder.repeat_type,
      priority: reminder.priority,
      status: 'upcoming',
      completed: false
    };
    fetch(`${apiUrl}/api/reminders/${reminder.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify(reminderData)
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(errData => {
            throw new Error(errData.detail || "Failed to snooze reminder");
          });
        }
        return res.json();
      })
      .then(data => {
        setReminders(prev => prev.map(r => r.id === data.id ? data : r));
        alert(`Snoozed reminder "${reminder.title}" by ${minutes} minutes.`);
      })
      .catch(err => alert(err.message));
  };

  const handleEditClick = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setReminderTitleInput(reminder.title);
    setReminderDescriptionInput(reminder.description || '');
    try {
      const d = new Date(reminder.datetime);
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
      setReminderDateTimeInput(localISOTime);
    } catch {
      setReminderDateTimeInput('');
    }
    setReminderRepeatTypeInput(reminder.repeat_type);
    setReminderPriorityInput(reminder.priority);
  };

  const handleDeleteReminder = (reminderId: string) => {
    if (!user) return;
    fetch(`${apiUrl}/api/reminders/${reminderId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to delete reminder");
        setReminders(prev => prev.filter(r => r.id !== reminderId));
      })
      .catch(err => {
        console.error(err);
        alert("Failed to delete reminder. Please try again.");
      });
  };

  // Documents CRUD & AI helpers
  const handleSaveDocument = () => {
    if (!user || !docTitleInput.trim()) return;
    const docData = {
      title: docTitleInput,
      content: docContentInput,
      type: selectedDocType
    };

    if (activeDocument && activeDocument.id !== 'new') {
      fetch(`${apiUrl}/api/documents/${activeDocument.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(docData)
      })
        .then(res => {
          if (!res.ok) throw new Error("Failed to save document modifications");
          return res.json();
        })
        .then(data => {
          setDocuments(prev => prev.map(d => d.id === data.id ? data : d));
          localStorage.removeItem(`mega_assistant_unsaved_content_${data.id}`);
          localStorage.removeItem(`mega_assistant_unsaved_title_${data.id}`);
          setActiveDocument(data);
          setIsEditingDoc(false);
        })
        .catch(err => {
          console.error(err);
          alert(err.message || "Failed to update document. Please try again.");
        });
    } else {
      fetch(`${apiUrl}/api/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(docData)
      })
        .then(res => {
          if (!res.ok) throw new Error("Failed to save new document");
          return res.json();
        })
        .then(data => {
          setDocuments(prev => [data, ...prev]);
          localStorage.removeItem('mega_assistant_unsaved_content_new');
          localStorage.removeItem('mega_assistant_unsaved_title_new');
          localStorage.removeItem('mega_assistant_unsaved_type_new');
          setActiveDocument(data);
          setIsEditingDoc(false);
        })
        .catch(err => {
          console.error(err);
          alert(err.message || "Failed to save document. Please try again.");
        });
    }
  };

  const handleDeleteDocument = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    
    fetch(`${apiUrl}/api/documents/${docId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to delete document");
        setDocuments(prev => prev.filter(d => d.id !== docId));
        localStorage.removeItem(`mega_assistant_unsaved_content_${docId}`);
        localStorage.removeItem(`mega_assistant_unsaved_title_${docId}`);
        if (activeDocument?.id === docId) {
          setActiveDocument(null);
        }
      })
      .catch(err => {
        console.error(err);
        alert("Failed to delete the document. Please try again.");
      });
  };

  const handleGenerateDocument = () => {
    if (!user || !docPromptInput.trim()) return;
    setIsGeneratingDoc(true);
    
    fetch(`${apiUrl}/api/documents/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify({
        type: selectedDocType,
        prompt: docPromptInput
      })
    })
      .then(async res => {
        if (!res.ok) {
          let errMsg = "Failed to generate";
          try {
            const errData = await res.json();
            if (errData && errData.detail) {
              errMsg = errData.detail;
            }
          } catch(e) {}
          throw new Error(errMsg);
        }
        return res.json();
      })
      .then(data => {
        setIsGeneratingDoc(false);
        setDocTitleInput(data.title);
        setDocContentInput(data.content);
        setDocPromptInput('');
        setActiveDocument({
          id: 'new',
          user_id: "",
          title: data.title,
          content: data.content,
          type: data.type,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        setIsEditingDoc(false);
      })
      .catch(err => {
        setIsGeneratingDoc(false);
        console.error(err);
        alert("AI Document Generation failed: " + err.message);
      });
  };

  const handleRefineDocument = (action: string) => {
    if (!user) return;
    setRefineActionActive(true);
    
    const refineData = {
      action: action,
      content: docContentInput,
      target_tone: action === 'rewrite_tone' ? targetRewriteTone : undefined,
      target_lang: action === 'translate' ? targetTranslateLang : undefined
    };
    
    fetch(`${apiUrl}/api/documents/refine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify(refineData)
    })
      .then(res => {
        if (!res.ok) throw new Error("Refinement failed");
        return res.json();
      })
      .then(data => {
        setRefineActionActive(false);
        setDocContentInput(data.content);
        if (activeDocument) {
          setActiveDocument(prev => prev ? { ...prev, content: data.content } : null);
        }
      })
      .catch(err => {
        setRefineActionActive(false);
        console.error(err);
        alert("Refinement failed. Please try again.");
      });
  };
  const handleTranslateDocument = () => {
    if (!user || !docContentInput.trim()) return;
    setIsTranslatingDoc(true);
    
    fetch(`${apiUrl}/api/documents/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify({
        text: docContentInput,
        source_lang: sourceTranslateLang,
        target_lang: targetTranslateLang
      })
    })
      .then(res => {
        if (!res.ok) throw new Error("Translation failed");
        return res.json();
      })
      .then(data => {
        setIsTranslatingDoc(false);
        setDocContentInput(data.translated_text);
        if (activeDocument) {
          setActiveDocument(prev => prev ? { ...prev, content: data.translated_text } : null);
        }
      })
      .catch(err => {
        setIsTranslatingDoc(false);
        console.error(err);
        alert("Translation failed. Please verify connection and try again.");
      });
  };
  const handleRewriteToneDocument = () => {
    if (!user || !docContentInput.trim()) return;
    setIsRewritingDoc(true);
    
    fetch(`${apiUrl}/api/documents/rewrite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify({
        text: docContentInput,
        tone: targetRewriteTone,
        custom_tone_instruction: targetRewriteTone === 'custom' ? customToneInstruction : undefined
      })
    })
      .then(res => {
        if (!res.ok) throw new Error("Rewriting failed");
        return res.json();
      })
      .then(data => {
        setIsRewritingDoc(false);
        setDocContentInput(data.rewritten_text);
        if (activeDocument) {
          setActiveDocument(prev => prev ? { ...prev, content: data.rewritten_text } : null);
        }
      })
      .catch(err => {
        setIsRewritingDoc(false);
        console.error(err);
        alert("Writing Assistant rewriting failed. Please try again.");
      });
  };
  // Automation Helpers
  const handleParseAutomationNL = () => {
    if (!user || !automationNLInput.trim()) return;
    setIsParsingWorkflow(true);
    
    fetch(`${apiUrl}/api/workflows/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify({ prompt: automationNLInput })
    })
      .then(res => {
        if (!res.ok) throw new Error("Parsing failed");
        return res.json();
      })
      .then(parsedData => {
        return fetch(`${apiUrl}/api/workflows`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token}`
          },
          body: JSON.stringify(parsedData)
        });
      })
      .then(res => {
        if (!res.ok) throw new Error("Workflow creation failed");
        return res.json();
      })
      .then(newFlow => {
        setIsParsingWorkflow(false);
        setAutomationNLInput('');
        setWorkflows(prev => [newFlow, ...prev]);
        
        fetch(`${apiUrl}/api/workflows/history`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        })
          .then(res => res.json())
          .then(hist => setWorkflowHistory(hist || []))
          .catch(() => {});
          
        alert(`Workflow automated successfully: "${newFlow.name}"`);
      })
      .catch(err => {
        setIsParsingWorkflow(false);
        console.error(err);
        alert("Failed to automate workflow using AI. Please check your instructions and try again.");
      });
  };

  const handleCreateOrUpdateWorkflow = () => {
    if (!user || !wfFormName.trim()) return;
    
    const flowData = {
      name: wfFormName,
      trigger_type: wfFormTriggerType,
      trigger_detail: wfFormTriggerDetail,
      actions: wfFormActions
    };
    
    const isEdit = !!editingWorkflow;
    const url = isEdit ? `${apiUrl}/api/workflows/${editingWorkflow.id}` : `${apiUrl}/api/workflows`;
    const method = isEdit ? 'PUT' : 'POST';
    
    fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify(flowData)
    })
      .then(res => {
        if (!res.ok) throw new Error("Save failed");
        return res.json();
      })
      .then(data => {
        if (isEdit) {
          setWorkflows(prev => prev.map(w => w.id === data.id ? data : w));
        } else {
          setWorkflows(prev => [data, ...prev]);
          fetch(`${apiUrl}/api/notifications`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
          })
            .then(res => res.json())
            .then(notifsData => {
              const notifs = notifsData || [];
              setNotificationsList(notifs);
              setUnreadNotificationCount(notifs.filter((n: any) => n.status === 'unread').length);
            })
            .catch(e => console.error("Failed to refresh notifications after workflow creation:", e));
        }
        setIsCreatingWorkflow(false);
        setEditingWorkflow(null);
        setWfFormName('');
        setWfFormTriggerType('schedule');
        setWfFormTriggerDetail('');
        setWfFormActions([]);
      })
      .catch(err => {
        console.error(err);
        alert("Failed to save workflow. Please verify all details.");
      });
  };

  const handleToggleWorkflow = (flow: Workflow) => {
    if (!user) return;
    const updatedStatus = !flow.enabled;
    
    fetch(`${apiUrl}/api/workflows/${flow.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify({ enabled: updatedStatus })
    })
      .then(res => {
        if (!res.ok) throw new Error("Toggle status update failed");
        return res.json();
      })
      .then(data => {
        setWorkflows(prev => prev.map(w => w.id === data.id ? data : w));
      })
      .catch(err => {
        console.error(err);
        alert("Failed to toggle workflow status. Please try again.");
      });
  };

  const handleDeleteWorkflow = (workflowId: string) => {
    if (!user) return;
    if (!window.confirm("Are you sure you want to delete this workflow?")) return;
    
    fetch(`${apiUrl}/api/workflows/${workflowId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("Deletion failed");
        setWorkflows(prev => prev.filter(w => w.id !== workflowId));
      })
      .catch(err => {
        console.error(err);
        alert("Failed to delete workflow. Please try again.");
      });
  };
  const handleExecuteWorkflow = (workflowId: string) => {
    if (!user) return;
    setIsExecutingWorkflowId(workflowId);
    const syncNotifs = () => {
      fetch(`${apiUrl}/api/notifications`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      })
        .then(res => res.json())
        .then(notifsData => {
          const notifs = notifsData || [];
          setNotificationsList(notifs);
          setUnreadNotificationCount(notifs.filter((n: any) => n.status === 'unread').length);
        })
        .catch(e => console.error("Sync notifications failed:", e));
    };
    fetch(`${apiUrl}/api/workflows/${workflowId}/execute`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("Execution failed");
        return res.json();
      })
      .then(histEntry => {
        setIsExecutingWorkflowId(null);
        setWorkflowHistory(prev => [histEntry, ...prev]);
        syncNotifs();
        alert(`Workflow executed successfully!\nDetails: ${histEntry.details}`);
      })
      .catch(err => {
        setIsExecutingWorkflowId(null);
        console.error(err);
        syncNotifs();
        alert("Execution failed. Please verify action bindings.");
      });
    setTimeout(syncNotifs, 100);
  };
  const handleNotificationClick = (n: any) => {
    if (!user) return;
    
    // Mark as read
    if (n.status === 'unread') {
      handleMarkNotificationRead(n.id);
    }
    
    // Navigate based on type
    const category = n.type || '';
    if (category === 'reminder') {
      setActiveTab('reminders');
    } else if (category === 'task') {
      setActiveTab('tasks');
    } else if (category === 'automation') {
      setActiveTab('automation');
    } else if (category === 'documents_files') {
      setActiveTab('documents');
    } else if (category === 'image_gen') {
      if (n.related_module) {
        setActiveSessionId(n.related_module);
        setActiveTab('chat');
      } else {
        setActiveTab('chat');
      }
    } else if (category === 'account_security') {
      setShowSettingsDialog(true);
      setActiveSettingsTab('security');
    } else if (category === 'plan_billing') {
      alert("Billing and Subscription plans are disabled.");
    }
  };

  // Notification CRUD Helpers
  const handleMarkNotificationRead = (notifId: string) => {
    if (!user) return;
    setNotificationsList(prev => prev.map(n => n.id === notifId ? { ...n, status: 'read' } : n));
    setUnreadNotificationCount(prev => Math.max(0, prev - 1));
    fetch(`${apiUrl}/api/notifications/${notifId}/read`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to mark as read");
      })
      .catch(err => {
        console.error(err);
        fetch(`${apiUrl}/api/notifications`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        })
          .then(res => res.json())
          .then(data => {
            const notifs = data || [];
            setNotificationsList(notifs);
            setUnreadNotificationCount(notifs.filter((n: any) => n.status === 'unread').length);
          });
      });
  };

  const handleDeleteNotification = (notifId: string) => {
    if (!user) return;
    const originalList = [...notificationsList];
    const originalCount = unreadNotificationCount;
    const target = notificationsList.find(n => n.id === notifId);
    setNotificationsList(prev => prev.filter(n => n.id !== notifId));
    if (target && target.status === 'unread') {
      setUnreadNotificationCount(prev => Math.max(0, prev - 1));
    }
    fetch(`${apiUrl}/api/notifications/${notifId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to delete notification");
      })
      .catch(err => {
        console.error(err);
        alert("Failed to delete notification. Retrying sync...");
        setNotificationsList(originalList);
        setUnreadNotificationCount(originalCount);
      });
  };

  // Request browser push notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Poll notifications at intervals (every 15s) to catch reminders
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetch(`${apiUrl}/api/notifications`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      })
        .then(res => res.json())
        .then(data => {
          const notifs = data || [];
          const oldUnreads = notificationsList.filter(n => n.status === 'unread').map(n => n.id);
          const newUnreads = notifs.filter((n: any) => n.status === 'unread');
          setNotificationsList(notifs);
          setUnreadNotificationCount(newUnreads.length);
          
          newUnreads.forEach((n: any) => {
            if (!oldUnreads.includes(n.id)) {
              if (Notification.permission === 'granted') {
                new Notification(n.title, {
                  body: n.message,
                  icon: '/favicon.ico'
                });
              }
            }
          });
        })
        .catch(e => console.error("Poll notifications check failed:", e));
    }, 15000);
    return () => clearInterval(interval);
  }, [user?.id, user?.token, apiUrl, notificationsList]);
  const handleCopyDocumentContent = () => {
    navigator.clipboard.writeText(docContentInput);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleExportDocument = (docId: string, format: string) => {
    if (!user) return;
    const url = `${apiUrl}/api/documents/${docId}/export/${format}`;
    
    fetch(url, {
      headers: {
        'Authorization': `Bearer ${user.token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to export");
        return res.blob();
      })
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = downloadUrl;
        
        const title = activeDocument?.title || "document";
        const ext = format === "markdown" ? "md" : format;
        a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.${ext}`;
        
        window.document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      })
      .catch(err => console.error("Export error:", err));
  };

  // Auth Submit Handlers
  const handleSwitchAccount = (targetUser: User) => {
    setUser(targetUser);
    localStorage.setItem('mega_chat_user', JSON.stringify(targetUser));
    setProfileMenuOpen(false);
    
    // Clear workspaces so data updates cleanly
    setSessions([]);
    setActiveSessionId('');
    setNotes([]);
    setTasks([]);
    setReminders([]);
    setNotificationsList([]);
    setUnreadNotificationCount(0);
  };

  const handleRemoveAccount = (idToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = accounts.filter(a => a.id !== idToRemove);
    setAccounts(remaining);
    localStorage.setItem('mega_accounts', JSON.stringify(remaining));
  };

  const handleLogout = () => {
    const remaining = accounts.filter(a => a.id !== user?.id);
    setAccounts(remaining);
    localStorage.setItem('mega_accounts', JSON.stringify(remaining));

    fetch(`${apiUrl}/api/auth/logout`, {
      method: 'POST'
    }).catch(() => {});

    if (remaining.length > 0) {
      handleSwitchAccount(remaining[0]);
    } else {
      localStorage.removeItem('mega_chat_user');
      localStorage.removeItem('mega_assistant_active_tab');
      localStorage.removeItem('mega_assistant_active_doc_id');
      localStorage.removeItem('mega_assistant_selected_doc_type');
      localStorage.removeItem('mega_assistant_target_rewrite_tone');
      localStorage.removeItem('mega_assistant_custom_tone_instruction');
      localStorage.removeItem('mega_assistant_source_translate_lang');
      localStorage.removeItem('mega_assistant_target_translate_lang');
      
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('mega_assistant_unsaved_')) {
          localStorage.removeItem(key);
        }
      }
      
      setUser(null);
      setSessions([]);
      setActiveSessionId('');
      setAuthView('login');
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthLoading(true);

    fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail, password: authPassword })
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((err) => { throw new Error(err.detail || "Login failed"); });
        }
        return res.json();
      })
      .then((data) => {
        setAuthLoading(false);
        setUser(data);
        localStorage.setItem('mega_chat_user', JSON.stringify(data));
        setAuthEmail('');
        setAuthPassword('');
      })
      .catch((err) => {
        setAuthLoading(false);
        setAuthError(err.message);
      });
  };

  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (authPassword !== authConfirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    setAuthLoading(true);

    fetch(`${apiUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: authName, email: authEmail, password: authPassword })
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((err) => { throw new Error(err.detail || "Registration failed"); });
        }
        return res.json();
      })
      .then((data) => {
        setAuthLoading(false);
        setAuthSuccess("Account created successfully! Logging you in...");
        setTimeout(() => {
          setUser(data);
          localStorage.setItem('mega_chat_user', JSON.stringify(data));
          setAuthName('');
          setAuthEmail('');
          setAuthPassword('');
          setAuthConfirmPassword('');
          setAuthSuccess(null);
        }, 1200);
      })
      .catch((err) => {
        setAuthLoading(false);
        setAuthError(err.message);
      });
  };

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (!authEmail.trim()) {
      setAuthError("Please enter your email address.");
      return;
    }

    setAuthSuccess("Password reset instructions have been sent to your email (UI Demonstration only).");
    setAuthEmail('');
  };

  // Google OAuth Login handlers (Simulated)
  const handleGoogleAccountSelect = (googleUser: { name: string; email: string; google_id: string; avatar: string }) => {
    setShowGoogleConsent(false);
    setAuthLoading(true);
    setAuthError(null);

    fetch(`${apiUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(googleUser)
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((err) => { throw new Error(err.detail || "Google Login failed"); });
        }
        return res.json();
      })
      .then((data) => {
        setAuthLoading(false);
        setUser(data);
        localStorage.setItem('mega_chat_user', JSON.stringify(data));
      })
      .catch((err) => {
        setAuthLoading(false);
        setAuthError(err.message);
      });
  };

  // User Profile details update handler
  const handleProfileUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAuthError(null);
    setAuthSuccess(null);

    const trimmedName = editProfileName.trim();
    if (!trimmedName) {
      setAuthError("Name cannot be empty.");
      return;
    }

    fetch(`${apiUrl}/api/user/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify({
        name: trimmedName,
        avatar: editProfileAvatar,
        username: editProfileUsername,
        bio: editProfileBio,
        phone: editProfilePhone,
        country: editProfileCountry,
        language: editProfileLanguage,
        timezone: editProfileTimezone
      })
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((err) => { throw new Error(err.detail || "Failed to update profile"); });
        }
        return res.json();
      })
      .then((data) => {
        setAuthSuccess("Profile updated successfully!");
        const updatedUser = {
          ...user,
          ...data
        };
        setUser(updatedUser);
        localStorage.setItem('mega_chat_user', JSON.stringify(updatedUser));
        setIsEditingProfile(false);
        setTimeout(() => setAuthSuccess(null), 2000);
      })
      .catch((err) => {
        setAuthError(err.message);
      });
  };

  // Profile Avatar Base64 Upload handler
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert("Profile picture size exceeds the maximum limit of 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Str = reader.result as string;
      if (base64Str) {
        setCropImageSrc(base64Str);
        setCropZoom(1);
        setCropOffsetX(0);
        setCropOffsetY(0);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setEditProfileAvatar('');
  };

  const handleApplyCrop = () => {
    if (!cropImageSrc) return;
    const img = new Image();
    img.src = cropImageSrc;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 250;
      canvas.height = 250;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 250, 250);
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(125, 125, 125, 0, Math.PI * 2);
        ctx.clip();
        
        const size = Math.min(img.width, img.height);
        const drawWidth = (img.width / size) * 250 * cropZoom;
        const drawHeight = (img.height / size) * 250 * cropZoom;
        
        const x = 125 - drawWidth / 2 + cropOffsetX;
        const y = 125 - drawHeight / 2 + cropOffsetY;
        
        ctx.drawImage(img, x, y, drawWidth, drawHeight);
        ctx.restore();
        
        const croppedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        setEditProfileAvatar(croppedBase64);
        setCropImageSrc(null);
      }
    };
  };

  const handleUsernameChange = (val: string) => {
    let sanitized = val.toLowerCase().replace(/\s+/g, '');
    if (sanitized && !sanitized.startsWith('@')) {
      sanitized = '@' + sanitized;
    }
    sanitized = '@' + sanitized.slice(1).replace(/[^a-z0-9_\.]/g, '');
    
    setEditProfileUsername(sanitized);
    
    if (sanitized.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    
    setCheckingUsername(true);
    fetch(`${apiUrl}/api/user/check-username?username=${encodeURIComponent(sanitized)}`, {
      headers: { 'Authorization': `Bearer ${user?.token}` }
    })
      .then(res => res.json())
      .then(data => {
        setUsernameAvailable(data.available);
        setCheckingUsername(false);
      })
      .catch(() => {
        setCheckingUsername(false);
      });
  };

  const handleSecurityPasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSecError(null);
    setSecSuccess(null);

    if (secNewPassword !== secConfirmPassword) {
      setSecError("New passwords do not match.");
      return;
    }
    if (secNewPassword.length < 6) {
      setSecError("Password must be at least 6 characters long.");
      return;
    }

    setSecLoading(true);
    fetch(`${apiUrl}/api/user/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify({
        current_password: secCurrentPassword,
        new_password: secNewPassword
      })
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || "Failed to change password");
        }
        return res.json();
      })
      .then(() => {
        setSecSuccess("Password updated successfully!");
        setSecCurrentPassword('');
        setSecNewPassword('');
        setSecConfirmPassword('');
        setSecLoading(false);
        setTimeout(() => setSecSuccess(null), 3000);
      })
      .catch((err) => {
        setSecError(err.message);
        setSecLoading(false);
      });
  };

  const handleAccountDeletion = () => {
    if (!user) return;
    const confirmDel = window.confirm("Are you absolutely sure you want to permanently delete your account? This action is irreversible.");
    if (!confirmDel) return;

    fetch(`${apiUrl}/api/user/delete-account`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || "Failed to delete account");
        }
        return res.json();
      })
      .then(() => {
        alert("Your account has been deleted successfully.");
        handleLogout();
      })
      .catch((err) => {
        alert(`Deletion failed: ${err.message}`);
      });
  };

  const handleAddAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddAccountError(null);
    setAddAccountLoading(true);

    fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: addAccountEmail, password: addAccountPassword })
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || "Login failed");
        }
        return res.json();
      })
      .then((data) => {
        setAddAccountLoading(false);
        // Add to accounts list
        setAccounts(prev => {
          const exists = prev.some(a => a.id === data.id);
          let nextList = prev;
          if (!exists) {
            nextList = [...prev, data];
          } else {
            nextList = prev.map(a => a.id === data.id ? data : a);
          }
          localStorage.setItem('mega_accounts', JSON.stringify(nextList));
          return nextList;
        });
        
        // Switch to this new user active session
        setUser(data);
        localStorage.setItem('mega_chat_user', JSON.stringify(data));
        
        // Reset states
        setAddAccountEmail('');
        setAddAccountPassword('');
        closeRouteDialog('addAccount');
      })
      .catch((err) => {
        setAddAccountLoading(false);
        setAddAccountError(err.message);
      });
  };

  // Save memory manually
  const handleSaveMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMemoryContent.trim()) return;
    setAuthError(null);
    setAuthSuccess(null);

    fetch(`${apiUrl}/api/memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify({ content: newMemoryContent.trim() })
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((err) => { throw new Error(err.detail || "Failed to save memory"); });
        }
        return res.json();
      })
      .then((newMem) => {
        setMemories((prev) => {
          if (prev.some((m) => m.id === newMem.id)) return prev;
          return [newMem, ...prev];
        });
        setNewMemoryContent('');
        setAuthSuccess("Memory saved successfully!");
        setTimeout(() => setAuthSuccess(null), 2000);
      })
      .catch((err) => setAuthError(err.message));
  };

  // Delete specific memory fact
  const handleDeleteMemory = (memoryId: string) => {
    if (!user) return;
    setAuthError(null);
    setAuthSuccess(null);

    fetch(`${apiUrl}/api/memories/${memoryId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${user.token}`
      }
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((err) => { throw new Error(err.detail || "Failed to delete memory"); });
        }
        setMemories((prev) => prev.filter((m) => m.id !== memoryId));
        setAuthSuccess("Memory deleted successfully!");
        setTimeout(() => setAuthSuccess(null), 2000);
      })
      .catch((err) => setAuthError(err.message));
  };

  // Clear all memories bulk
  const handleClearAllMemories = () => {
    if (!user) return;
    if (!window.confirm("Are you sure you want to clear all saved AI memories?")) return;
    setAuthError(null);
    setAuthSuccess(null);

    fetch(`${apiUrl}/api/memories`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${user.token}`
      }
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((err) => { throw new Error(err.detail || "Failed to clear memories"); });
        }
        setMemories([]);
        setAuthSuccess("All memories cleared!");
        setTimeout(() => setAuthSuccess(null), 2000);
      })
      .catch((err) => setAuthError(err.message));
  };

  // Share chat session
  // const handleShareChat = (session: ChatSession) => {
  //   const shareUrl = `${window.location.origin}/share/${session.id}`;
  //   navigator.clipboard.writeText(shareUrl)
  //     .then(() => {
  //       alert(`Share link copied to clipboard!\n\nLink: ${shareUrl}`);
  //     })
  //     .catch((err) => {
  //       console.error("Failed to copy link:", err);
  //       alert(`Failed to copy automatically. Share link: ${shareUrl}`);
  //     });
  // };

  // Pin / Unpin chat session
  const handlePinChat = (sessionId: string, currentPinnedStatus: boolean) => {
    if (!user) return;
    const endpoint = currentPinnedStatus ? 'unpin' : 'pin';

    fetch(`${apiUrl}/api/chats/${sessionId}/${endpoint}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${user.token}`
      }
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to toggle chat pin status");
        }
        return res.json();
      })
      .then((updatedChat) => {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, pinned: updatedChat.pinned } : s))
        );
      })
      .catch((err) => console.error("Failed to pin chat:", err));
  };

  // Favorite / Unfavorite chat session
  // const handleFavoriteChat = (sessionId: string, currentFavoriteStatus: boolean) => {
  //   if (!user) return;
  //   const endpoint = currentFavoriteStatus ? 'unfavorite' : 'favorite';
  // 
  //   fetch(`${apiUrl}/api/chats/${sessionId}/${endpoint}`, {
  //     method: 'PUT',
  //     headers: {
  //       'Authorization': `Bearer ${user.token}`
  //     }
  //   })
  //     .then((res) => {
  //       if (!res.ok) {
  //         throw new Error("Failed to toggle chat favorite status");
  //       }
  //       return res.json();
  //     })
  //     .then((updatedChat) => {
  //       setSessions((prev) =>
  //         prev.map((s) => (s.id === sessionId ? { ...s, favorite: updatedChat.favorite } : s))
  //       );
  //     })
  //     .catch((err) => console.error("Failed to favorite chat:", err));
  // };

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0] || {
    id: '',
    title: 'New Chat',
    messages: []
  };

  // Restore scroll position or auto-scroll to bottom if user sent a message
  useEffect(() => {
    if (!chatContainerRef.current || !activeSessionId) return;

    if (shouldAutoScrollToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      shouldAutoScrollToBottomRef.current = false;
      return;
    }

    const savedScroll = getSavedChatScrollPosition(activeSessionId);
    if (savedScroll !== null) {
      const el = chatContainerRef.current;
      requestAnimationFrame(() => {
        if (el) {
          el.scrollTop = savedScroll;
        }
      });
    }
  }, [activeSessionId, activeSession.messages.length]);

  // Keep auto-scroll active when AI is typing/generating response
  useEffect(() => {
    if (isTyping) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isTyping]);

  // Resize Textarea dynamically based on value
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  // Send a message
  const handleSendMessage = async (customText?: any, isFromVoice?: boolean) => {
    const userMsgText = (customText && typeof customText === 'string') ? customText : inputValue;
    if ((!userMsgText.trim() && !uploadedFileInfo) || isTyping) return;
    if (selectedFile && !uploadedFileInfo && !uploadError) return;

    shouldAutoScrollToBottomRef.current = true;

    if (activeTab !== 'chat') {
      setActiveTab('chat');
    }

    let currentSessionId = activeSessionId;
    let updatedSessions = [...sessions];

    // Auto-create chat if no active session exists
    if (!currentSessionId || sessions.length === 0) {
      try {
        const res = await fetch(`${apiUrl}/api/chats`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user?.token}`
          },
          body: JSON.stringify({ title: 'New Chat' })
        });
        if (!res.ok) throw new Error("Failed to create chat");
        const newChat = await res.json();
        currentSessionId = newChat.id;
        const defaultChat: ChatSession = {
          ...newChat,
          messages: []
        };
        updatedSessions = [defaultChat];
        setSessions(updatedSessions);
        setActiveSessionId(currentSessionId);
      } catch (err) {
        console.error("Failed to auto-create active session:", err);
        return;
      }
    }

    const filePayload = uploadedFileInfo;

    const userMessage: Message = {
      id: Math.random().toString(),
      sender: 'user',
      text: userMsgText,
      timestamp: new Date(),
      ...(filePayload ? { file: filePayload } : {}),
    };

    // Update active session messages
    setSessions((prev) => {
      const list = prev.length > 0 ? prev : updatedSessions;
      return list.map((s) => {
        if (s.id === currentSessionId) {
          // If title was "New Chat", rename it to prompt or filename
          let title = s.title;
          if (s.title === 'New Chat') {
            if (userMsgText.trim().length > 0) {
              title = userMsgText.length > 25 ? userMsgText.slice(0, 25) + '...' : userMsgText;
            } else if (filePayload) {
              title = `Analyze: ${filePayload.filename}`;
            }
          }
          return {
            ...s,
            title,
            messages: [...s.messages, userMessage],
          };
        }
        return s;
      });
    });

    setInputValue('');
    handleRemoveFile();
    setIsTyping(true);

    if (imageGenEnabled) {
      fetch(`${apiUrl}/api/image/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({ chat_id: currentSessionId, prompt: userMsgText }),
      })
        .then(async (res) => {
          if (!res.ok) {
            let errMsg = "Unable to generate image from the backend. Please check server logs.";
            try {
              const errData = await res.json();
              if (errData.detail && errData.detail.message) {
                errMsg = errData.detail.message;
              } else if (errData.detail) {
                errMsg = errData.detail;
              }
            } catch (e) {}
            throw new Error(errMsg);
          }
          return res.json();
        })
        .then((data) => {
          setIsTyping(false);
          fetchUserUsage();
          const botMessage: Message = {
            id: Math.random().toString(),
            sender: 'bot',
            text: `Here is the generated image for your prompt: "${userMsgText}"`,
            timestamp: new Date(),
            image_url: data.image_url
          };

          setSessions((prev) =>
            prev.map((s) => {
              if (s.id === currentSessionId) {
                const title = s.title === 'New Chat' ? (userMsgText.length > 25 ? userMsgText.slice(0, 25) + '...' : userMsgText) : s.title;
                return {
                  ...s,
                  title,
                  messages: [...s.messages, botMessage],
                };
              }
              return s;
            })
          );
        })
        .catch((err) => {
          setIsTyping(false);
          const botMessage: Message = {
            id: Math.random().toString(),
            sender: 'bot',
            text: `Error: ${err.message || "Unable to generate image from the backend."}`,
            timestamp: new Date(),
          };
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id === currentSessionId) {
                return {
                  ...s,
                  messages: [...s.messages, botMessage],
                };
              }
              return s;
            })
          );
        });
      return;
    }

    // Call backend endpoint /api/chat
    fetch(`${apiUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user?.token}`
      },
      body: JSON.stringify({ chat_id: currentSessionId, message: userMsgText, file: filePayload, web_search: webSearchEnabled }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed with status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setIsTyping(false);
        const botMessage: Message = {
          id: Math.random().toString(),
          sender: 'bot',
          text: data.reply || "No response received.",
          timestamp: new Date(),
          sources: data.sources || undefined,
          used_sources: data.used_sources || undefined,
          agent: data.agent || undefined,
          tool_info: data.tool_info || undefined
        };

        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === currentSessionId) {
              const title = s.title === 'New Chat' ? (userMsgText.length > 25 ? userMsgText.slice(0, 25) + '...' : userMsgText) : s.title;
              return {
                ...s,
                title,
                messages: [...s.messages, botMessage],
              };
            }
            return s;
          })
        );
        fetchProductivityData();
        if (isFromVoice || isVoiceResponseEnabled || shouldSpeakNext) {
          speakVoiceResponse(data.reply || "No response received.");
          setShouldSpeakNext(false);
        }
      })
      .catch(() => {
        setIsTyping(false);
        const botMessage: Message = {
          id: Math.random().toString(),
          sender: 'bot',
          text: "Error: Unable to connect to the backend server. Please verify the API backend is running.",
          timestamp: new Date(),
        };

        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === currentSessionId) {
              return {
                ...s,
                messages: [...s.messages, botMessage],
              };
            }
            return s;
          })
        );
      });
  };

  // Create a new chat
  const handleNewChat = () => {
    fetch(`${apiUrl}/api/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user?.token}`
      },
      body: JSON.stringify({ title: 'New Chat' }),
    })
      .then((res) => res.json())
      .then((newChat: any) => {
        const defaultChat: ChatSession = {
          ...newChat,
          messages: [],
        };
        setSessions((prev) => [defaultChat, ...prev]);
        selectChatSession(defaultChat.id);
        if (window.innerWidth < 768) {
          setSidebarOpen(false);
        }
      })
      .catch((err) => console.error("Failed to create new chat:", err));
  };

  // Clear current chat messages
  // const handleClearHistory = () => {
  //   if (!window.confirm("Are you sure you want to clear this conversation's messages?")) return;
  //   
  //   fetch(`${apiUrl}/api/chats/${activeSessionId}/messages`, {
  //     method: 'DELETE',
  //     headers: {
  //       'Authorization': `Bearer ${user?.token}`
  //     }
  //   })
  //     .then((res) => res.json())
  //     .then(() => {
  //       setSessions((prev) =>
  //         prev.map((s) => {
  //           if (s.id === activeSessionId) {
  //             return {
  //               ...s,
  //               messages: [],
  //             };
  //           }
  //           return s;
  //         })
  //       );
  //     })
  //     .catch((err) => console.error("Failed to clear messages:", err));
  // };

  // Delete a chat session
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmSessionId(sessionId);
  };

  const confirmDeleteSession = () => {
    if (!deleteConfirmSessionId) return;
    const sessionId = deleteConfirmSessionId;

    fetch(`${apiUrl}/api/chats/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${user?.token}`
      }
    })
      .then((res) => res.json())
      .then(() => {
        const remainingSessions = sessions.filter((s) => s.id !== sessionId);
        setSessions(remainingSessions);
        
        if (activeSessionId === sessionId) {
          if (remainingSessions.length > 0) {
            selectChatSession(remainingSessions[0].id, true);
          } else {
            handleNewChat();
          }
        }
        setDeleteConfirmSessionId(null);
      })
      .catch((err) => {
        console.error("Failed to delete chat session:", err);
        setDeleteConfirmSessionId(null);
      });
  };

  // Start rename session trigger
  const startRenameSession = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitleValue(session.title);
  };

  // Submit rename session
  const handleRenameSessionSubmit = (sessionId: string) => {
    const trimmedTitle = editTitleValue.trim();
    if (!trimmedTitle) {
      setEditingSessionId(null);
      return;
    }

    fetch(`${apiUrl}/api/chats/${sessionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user?.token}`
      },
      body: JSON.stringify({ title: trimmedTitle }),
    })
      .then((res) => res.json())
      .then((updatedChat: any) => {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === sessionId) {
              return {
                ...s,
                title: updatedChat.title,
              };
            }
            return s;
          })
        );
        setEditingSessionId(null);
      })
      .catch((err) => {
        console.error("Failed to rename chat:", err);
        setEditingSessionId(null);
      });
  };

  // Speak response using SpeechSynthesis API
  const speakVoiceResponse = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      // Remove markdown for clean speech
      const cleanText = text
        .replace(/[\*\_\`\#]/g, '')
        .replace(/-\s+/g, '')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'en-US';
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.includes('en-US') && (v.name.includes('Google') || v.name.includes('Natural')));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
      window.speechSynthesis.speak(utterance);
    }
  };

  // UI Voice Mic button feedback
  const handleVoiceClick = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Apple Safari.");
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
      setVoiceStatusText("Listening... Speak now");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setInputValue(transcript);
        setShouldSpeakNext(true);
        // Automatically submit user message via voice mode
        setTimeout(() => {
          handleSendMessage(transcript, true);
        }, 300);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);
      if (event.error === 'not-allowed') {
        alert("Microphone permission was denied. Please allow microphone access in settings.");
      } else {
        alert(`Voice Recognition Error: ${event.error}. Please try again.`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // File Upload Handlers

  const togglePlusMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPlusMenuOpen((prev) => !prev);
  };

  const attachCapturedPhoto = (file: File) => {
    const MAX_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError("File size exceeds the maximum limit of 20MB.");
      setSelectedFile(file);
      setUploadedFileInfo(null);
      setUploadProgress(null);
      return;
    }
    setSelectedFile(file);
    setUploadError(null);
    setUploadedFileInfo(null);
    handleFileUpload(file);
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
    setCameraDevices([]);
    setSelectedDeviceId('');
  };

  const takePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Mirror only if using a front-facing camera
        if (useFrontCameraMode) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `camera_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            attachCapturedPhoto(file);
          }
        }, 'image/jpeg');
      }
    }
    closeCamera();
  };

  const startCameraStream = (useFront: boolean, deviceId?: string) => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }

    const constraints: MediaStreamConstraints = {
      video: deviceId 
        ? { deviceId: { exact: deviceId } } 
        : { facingMode: useFront ? 'user' : 'environment' }
    };

    navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
        setCameraStream(stream);
        setIsCameraActive(true);

        navigator.mediaDevices.enumerateDevices()
          .then((devices) => {
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            setCameraDevices(videoDevices);

            const activeTrack = stream.getVideoTracks()[0];
            const activeSettings = activeTrack?.getSettings();
            if (activeSettings?.deviceId) {
              setSelectedDeviceId(activeSettings.deviceId);
            } else if (videoDevices.length > 0 && !deviceId) {
              setSelectedDeviceId(videoDevices[0].deviceId);
            }
          });
      })
      .catch((err) => {
        console.error("Camera access denied or unavailable:", err);
        if (!useFront && !deviceId) {
          console.log("Environment facing mode failed, trying user facing mode fallback");
          startCameraStream(true);
        } else {
          alert("Camera access denied or unavailable.");
          setIsCameraActive(false);
        }
      });
  };

  const triggerCamera = () => {
    setPlusMenuOpen(false);
    setUseFrontCameraMode(true);
    startCameraStream(true);
  };

  const switchCamera = () => {
    const nextFrontMode = !useFrontCameraMode;
    setUseFrontCameraMode(nextFrontMode);

    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobile) {
      startCameraStream(nextFrontMode);
    } else {
      if (cameraDevices.length > 1) {
        const currentIndex = cameraDevices.findIndex(d => d.deviceId === selectedDeviceId);
        const nextIndex = (currentIndex + 1) % cameraDevices.length;
        const nextDevice = cameraDevices[nextIndex];
        if (nextDevice) {
          setSelectedDeviceId(nextDevice.deviceId);
          startCameraStream(nextFrontMode, nextDevice.deviceId);
        }
      } else {
        startCameraStream(nextFrontMode);
      }
    }
  };

  useEffect(() => {
    if (isCameraActive && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [isCameraActive, cameraStream]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (20MB)
    const MAX_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError("File size exceeds the maximum limit of 20MB.");
      setSelectedFile(file);
      setUploadedFileInfo(null);
      setUploadProgress(null);
      return;
    }

    // Validate type
    const allowedExtensions = [
      'pdf', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'webp',
      'py', 'js', 'ts', 'java', 'cpp', 'html', 'css', 'json'
    ];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedExtensions.includes(ext)) {
      setUploadError(`File extension '.${ext}' is not allowed.`);
      setSelectedFile(file);
      setUploadedFileInfo(null);
      setUploadProgress(null);
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
    setUploadedFileInfo(null);
    
    // Trigger upload
    handleFileUpload(file);
  };

  const handleFileUpload = (file: File) => {
    setUploadProgress(0);
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiUrl}/api/upload${activeSessionId ? `?chat_id=${activeSessionId}` : ''}`);
    if (user?.token) {
      xhr.setRequestHeader("Authorization", `Bearer ${user.token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          setUploadedFileInfo(data);
          fetchUserUsage();
        } catch (e) {
          setUploadError("Failed to parse server upload response.");
        }
        setUploadProgress(null);
      } else {
        let errMsg = "Upload failed.";
        try {
          const errData = JSON.parse(xhr.responseText);
          if (errData.detail && errData.detail.message) {
            errMsg = errData.detail.message;
          } else {
            errMsg = errData.detail || errMsg;
          }
        } catch (e) {}
        setUploadError(errMsg);
        setUploadProgress(null);
      }
    };

    xhr.onerror = () => {
      setUploadError("Network connection error during upload.");
      setUploadProgress(null);
    };

    xhr.send(formData);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadProgress(null);
    setUploadedFileInfo(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!user) {
    return (
      <div className={`h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-200 ${isDark ? 'dark' : ''}`}>
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={() => setIsDark(!isDark)}
            className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-805 px-3 py-1.5 rounded-xl cursor-pointer text-xs font-semibold shadow-sm transition-all"
          >
            {isDark ? (
              <span className="flex items-center gap-1 text-indigo-400">
                <MoonIcon className="w-3.5 h-3.5" /> Dark
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-500">
                <SunIcon className="w-3.5 h-3.5" /> Light
              </span>
            )}
          </button>
        </div>

        {authView === 'login' && (
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xl p-8 space-y-6 mx-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center text-white shadow-md mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                Welcome back
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Please enter your details to sign in
              </p>
            </div>

            {authError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs px-3.5 py-2.5 rounded-xl">
                {authError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthError(null);
                      setAuthSuccess(null);
                      setAuthView('forgot');
                    }}
                    className="text-[10px] font-semibold text-indigo-500 hover:underline cursor-pointer bg-transparent border-none p-0"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className={`w-full flex items-center justify-center gap-2 text-white rounded-xl py-3 text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${getThemeClasses(themePref).primary}`}
              >
                {authLoading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-250 dark:border-slate-800"></div>
              <span className="flex-shrink mx-4 text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Or</span>
              <div className="flex-grow border-t border-slate-250 dark:border-slate-800"></div>
            </div>

            <button
              type="button"
              onClick={() => {
                setAuthError(null);
                setAuthSuccess(null);
                setShowGoogleConsent(true);
              }}
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl py-3 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <GoogleIcon className="w-4 h-4" />
              Continue with Google
            </button>

            <div className="text-center pt-2">
              <span className="text-xs text-slate-400">
                Don't have an account?{" "}
                <button
                  onClick={() => {
                    setAuthError(null);
                    setAuthSuccess(null);
                    setAuthView('signup');
                  }}
                  className="text-xs font-semibold text-indigo-500 hover:underline cursor-pointer bg-transparent border-none p-0"
                >
                  Sign up
                </button>
              </span>
            </div>
          </div>
        )}

        {authView === 'signup' && (
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xl p-8 space-y-6 mx-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center text-white shadow-md mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                Create account
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Register to get access to Mega Assistant
              </p>
            </div>

            {authError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs px-3.5 py-2.5 rounded-xl">
                {authError}
              </div>
            )}

            {authSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs px-3.5 py-2.5 rounded-xl">
                {authSuccess}
              </div>
            )}

            <form onSubmit={handleSignUpSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                  Full name
                </label>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authConfirmPassword}
                  onChange={(e) => setAuthConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className={`w-full flex items-center justify-center gap-2 text-white rounded-xl py-3 text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${getThemeClasses(themePref).primary}`}
              >
                {authLoading ? "Creating account..." : "Create account"}
              </button>
            </form>

            <div className="text-center pt-2">
              <span className="text-xs text-slate-400">
                Already have an account?{" "}
                <button
                  onClick={() => {
                    setAuthError(null);
                    setAuthSuccess(null);
                    setAuthView('login');
                  }}
                  className="text-xs font-semibold text-indigo-500 hover:underline cursor-pointer bg-transparent border-none p-0"
                >
                  Sign in
                </button>
              </span>
            </div>
          </div>
        )}

        {authView === 'forgot' && (
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xl p-8 space-y-6 mx-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center text-white shadow-md mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-850 to-slate-650 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                Forgot password
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Enter your email address to receive reset guidelines
              </p>
            </div>

            {authError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs px-3.5 py-2.5 rounded-xl">
                {authError}
              </div>
            )}

            {authSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs px-3.5 py-2.5 rounded-xl">
                {authSuccess}
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 text-xs font-semibold shadow-md shadow-indigo-600/10 active:scale-[0.98] transition-all cursor-pointer"
              >
                Send Instructions
              </button>
            </form>

            <div className="text-center pt-2">
              <button
                onClick={() => {
                  setAuthError(null);
                  setAuthSuccess(null);
                  setAuthView('login');
                }}
                className="text-xs font-semibold text-indigo-500 hover:underline cursor-pointer bg-transparent border-none p-0"
              >
                Back to sign in
              </button>
            </div>
          </div>
        )}

        {showGoogleConsent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
            <div ref={googleConsentDialogRef} className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <GoogleIcon className="w-4 h-4" />
                  <span className="text-xs font-bold text-slate-850 dark:text-slate-100">Sign in with Google</span>
                </div>
                <button
                  onClick={() => setShowGoogleConsent(false)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-805 cursor-pointer"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-3">
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Choose an account</span>
                
                {[
                  {
                    name: "Google Developer",
                    email: "dev@google.com",
                    google_id: "google-dev-12345",
                    avatar: ""
                  },
                  {
                    name: "Alice Smith",
                    email: "alice@example.com",
                    google_id: "google-alice-98765",
                    avatar: ""
                  }
                ].map((account, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleGoogleAccountSelect(account)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-950 text-left transition-all cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      {account.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate flex-1">
                      <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{account.name}</span>
                      <span className="block text-[10px] text-slate-400 truncate">{account.email}</span>
                    </div>
                  </button>
                ))}
              </div>
              
              <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-relaxed text-center">
                To continue, Google will share your name, email address, language preference, and profile picture with Mega Assistant.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Sessions filtering & sorting pipeline
  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getChatActiveTime = (chat: ChatSession) => {
    if (chat.updated_at) {
      return new Date(chat.updated_at).getTime();
    }
    if (chat.messages && chat.messages.length > 0) {
      const lastMsg = chat.messages[chat.messages.length - 1];
      if (lastMsg.timestamp) {
        return new Date(lastMsg.timestamp).getTime();
      }
    }
    return 0;
  };

  const sortSessions = (list: ChatSession[]) => {
    return [...list].sort((a, b) => {
      return getChatActiveTime(b) - getChatActiveTime(a);
    });
  };

  const pinnedSessions = filteredSessions.filter((s) => s.pinned);
  // Recent chats contains ONLY unpinned chats
  const recentSessions = filteredSessions.filter((s) => !s.pinned);

  const sortedPinned = sortSessions(pinnedSessions);
  const sortedOthers = sortSessions(recentSessions);

  const renderSessionItem = (session: ChatSession) => {
    const isActive = session.id === activeSessionId;
    const isEditing = editingSessionId === session.id;
    return (
      <div
        key={session.id}
        className={`group relative flex items-center justify-between rounded-xl transition-all ${
          isActive
            ? `${getThemeClasses(themePref).activeItem} text-slate-900 dark:text-slate-100 shadow-sm`
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/40'
        }`}
      >
        {isEditing ? (
          <input
            type="text"
            value={editTitleValue}
            onChange={(e) => setEditTitleValue(e.target.value)}
            onBlur={() => handleRenameSessionSubmit(session.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRenameSessionSubmit(session.id);
              } else if (e.key === 'Escape') {
                setEditingSessionId(null);
              }
            }}
            autoFocus
            className="w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-3 py-2 text-xs rounded-xl outline-none border border-indigo-500/80 focus:ring-1 focus:ring-indigo-500"
          />
        ) : (
          <>
            <button
              onClick={() => {
                selectChatSession(session.id);
                if (window.innerWidth < 768) {
                  setSidebarOpen(false);
                }
              }}
              className="flex-1 text-left px-3 py-2.5 text-xs font-medium truncate cursor-pointer pr-24 flex items-center justify-between gap-1.5"
            >
              <span className="truncate">{session.title}</span>
              <div className="flex items-center gap-1 shrink-0">
                {session.favorite && <FavoriteIcon className="w-3 h-3 text-amber-500 shrink-0" solid />}
              </div>
            </button>
            
            {/* Hover Action Buttons */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              className="absolute right-2 flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity z-30"
            >
              {/* Direct Pin/Unpin button (always visible next to three-dot) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handlePinChat(session.id, !!session.pinned);
                }}
                title={session.pinned ? "Unpin chat" : "Pin chat"}
                aria-label={session.pinned ? "Unpin chat" : "Pin chat"}
                className={`p-1 rounded-lg hover:bg-slate-300/40 dark:hover:bg-slate-700/50 cursor-pointer transition-all ${
                  session.pinned ? 'text-indigo-500' : 'text-slate-400 hover:text-slate-655'
                }`}
              >
                {session.pinned ? (
                  <PinOffIcon className="w-3.5 h-3.5" solid={true} />
                ) : (
                  <PinIcon className="w-3.5 h-3.5" solid={false} />
                )}
              </button>

              {/* Three-dot menu button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setActiveMenuSessionId(activeMenuSessionId === session.id ? null : session.id);
                  }}
                  title="More actions"
                  aria-label="More actions"
                  className="px-1.5 py-0.5 rounded text-slate-405 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-300/40 dark:hover:bg-slate-800 cursor-pointer transition-all font-bold text-xs shrink-0 select-none"
                >
                  ⋯
                </button>

                {/* Dropdown Popover Menu */}
                {activeMenuSessionId === session.id && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 cursor-default" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuSessionId(null);
                      }} 
                    />
                    <div className="absolute right-0 top-full mt-1.5 w-32 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl p-1 z-50 text-left font-sans select-none animate-in fade-in zoom-in-95 duration-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuSessionId(null);
                          startRenameSession(session, e);
                        }}
                        className="w-full text-left px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl text-xs text-slate-700 dark:text-slate-200 font-semibold cursor-pointer transition-colors"
                      >
                        ✏️ Rename
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuSessionId(null);
                          handlePinChat(session.id, !!session.pinned);
                        }}
                        className="w-full text-left px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl text-xs text-slate-700 dark:text-slate-200 font-semibold cursor-pointer transition-colors"
                      >
                        📌 {session.pinned ? "Unpin chat" : "Pin chat"}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuSessionId(null);
                          handleDeleteSession(session.id, e);
                        }}
                        className="w-full text-left px-2.5 py-2 hover:bg-rose-50/50 hover:text-rose-600 dark:hover:bg-rose-950/40 rounded-xl text-xs text-rose-500 font-semibold cursor-pointer transition-colors"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderMarkdown = (markdown: string) => {
    if (!markdown) return '';

    // 0. Normalize Windows CRLF line endings to LF (\n)
    let cleaned = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 1. Remove raw 'svg' artifact lines & internal assistant name headers
    cleaned = cleaned.replace(/svg\/svg/gi, '').replace(/svg\nsvg/gi, '');
    cleaned = cleaned
      .split('\n')
      .filter(l => {
        const trimmed = l.trim().toLowerCase();
        return (
          trimmed !== 'svg' &&
          trimmed !== '<svg' &&
          trimmed !== '</svg>' &&
          trimmed !== 'svg/svg' &&
          trimmed !== 'general assistant' &&
          trimmed !== 'education assistant' &&
          trimmed !== 'coding assistant' &&
          trimmed !== 'research assistant' &&
          trimmed !== 'writing assistant'
        );
      })
      .join('\n');

    // 2. Clean backslash escapes for markdown symbols
    cleaned = cleaned
      .replace(/\\(#+)/g, '$1')
      .replace(/\\(\*+)/g, '$1')
      .replace(/\\(_+)/g, '$1')
      .replace(/\\(-+)/g, '$1')
      .replace(/\\(\+)/g, '$1')
      .replace(/\\(>)/g, '$1')
      .replace(/\\([\[\]\(\)])/g, '$1');

    // 3. Extract code blocks before paragraph splitting or HTML escaping
    const codeBlocks: string[] = [];
    cleaned = cleaned.replace(/```([a-zA-Z0-9_\-\+]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const rawLang = (lang || '').trim().toLowerCase();
      const displayLang = rawLang === 'svg' ? 'xml' : (rawLang || 'code');
      
      const cleanCode = code.replace(/^(svg\s*)+/gi, '').trim();
      const escapedCode = cleanCode
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const placeholder = `%%CODEBLOCK${codeBlocks.length}%%`;
      const codeHtml = `<div class="my-3 rounded-xl overflow-hidden border border-slate-700/60 dark:border-slate-800 bg-slate-950 text-slate-100 shadow-md">
        <div class="flex items-center justify-between px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
          <span>${displayLang}</span>
          <button onclick="navigator.clipboard.writeText(this.getAttribute('data-code')).then(() => { this.innerText='Copied!'; setTimeout(() => this.innerText='Copy', 2000); })" data-code="${escapedCode.replace(/"/g, '&quot;')}" class="hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer">Copy</button>
        </div>
        <pre class="p-3.5 font-mono text-xs overflow-x-auto text-slate-200 leading-relaxed"><code>${escapedCode.trim()}</code></pre>
      </div>`;
      codeBlocks.push(codeHtml);
      return placeholder;
    });

    // 4. HTML escape remaining text
    let html = cleaned
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // 5. Horizontal separators
    html = html.replace(/^[\-\*_]{3,}$/gm, '<hr class="my-4 border-t border-slate-200 dark:border-slate-800" />');

    // 6. Headers
    html = html.replace(/^#### (.*?)$/gm, '<h4 class="text-sm font-bold text-slate-900 dark:text-white mt-3 mb-1">$1</h4>');
    html = html.replace(/^### (.*?)$/gm, '<h3 class="text-base font-bold text-slate-900 dark:text-white mt-4 mb-1.5">$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h2 class="text-lg font-bold text-slate-900 dark:text-white mt-5 mb-2 pb-1 border-b border-slate-200 dark:border-slate-800">$1</h2>');
    html = html.replace(/^# (.*?)$/gm, '<h1 class="text-xl font-extrabold text-slate-900 dark:text-white mt-6 mb-3 pb-1.5 border-b-2 border-slate-200 dark:border-slate-700">$1</h1>');

    // 7. Bold & Italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
    html = html.replace(/_(.*?)_/g, '<em class="italic">$1</em>');

    // 8. Inline code
    html = html.replace(/`(.*?)`/g, '<code class="bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-xs text-indigo-600 dark:text-indigo-400 font-medium">$1</code>');

    // 9. List Items ($2 for numbered list content!)
    html = html.replace(/^\s*[\-\*]\s+(.*?)$/gm, '<li class="ul-item text-slate-700 dark:text-slate-350 mb-1">$1</li>');
    html = html.replace(/^\s*(\d+)\.\s+(.*?)$/gm, '<li class="ol-item text-slate-700 dark:text-slate-350 mb-1">$2</li>');

    // 10. Links
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 font-semibold underline hover:text-indigo-700 dark:hover:text-indigo-300">$1</a>');

    // 11. Split lines into paragraphs BEFORE wrapping list containers
    html = html.split('\n').map(line => {
      const l = line.trim();
      if (l === '') return '<div class="h-1.5"></div>';
      if (l.startsWith('<h') || l.startsWith('<li') || l.startsWith('<block') || l.startsWith('<hr') || l.startsWith('<div') || l.includes('%%CODEBLOCK')) {
        return line;
      }
      return `<p class="mb-2 text-slate-800 dark:text-slate-200 leading-relaxed">${line}</p>`;
    }).join('\n');

    // 12. Wrap consecutive list items in <ol> or <ul> AFTER line splitting
    html = html.replace(/(<li class="ol-item[^"]*">[\s\S]*?<\/li>\n?)+/g, (match) => {
      return `<ol class="list-decimal ml-6 space-y-1 my-2 text-slate-700 dark:text-slate-350">\n${match}</ol>`;
    });
    html = html.replace(/(<li class="ul-item[^"]*">[\s\S]*?<\/li>\n?)+/g, (match) => {
      return `<ul class="list-disc ml-6 space-y-1 my-2 text-slate-700 dark:text-slate-350">\n${match}</ul>`;
    });

    // 13. Blockquotes
    html = html.replace(/^&gt;\s+(.*?)$/gm, '<blockquote class="border-l-4 border-indigo-500 pl-3 italic text-slate-600 dark:text-slate-400 my-2">$1</blockquote>');

    // 14. Re-insert code block HTML placeholders
    codeBlocks.forEach((blockHtml, i) => {
      html = html.replace(`%%CODEBLOCK${i}%%`, blockHtml);
    });

    return html;
  };

  const renderDocumentsPage = () => {
    const filteredDocs = documents.filter(d =>
      d.title.toLowerCase().includes(docSearchQuery.toLowerCase()) ||
      d.content.toLowerCase().includes(docSearchQuery.toLowerCase())
    );

    const docTypes = [
      { value: 'resume', label: 'Resume' },
      { value: 'cover_letter', label: 'Cover Letter' },
      { value: 'report', label: 'Report' },
      { value: 'assignment', label: 'Assignment' },
      { value: 'email', label: 'Email' },
      { value: 'meeting_notes', label: 'Meeting Notes' }
    ];

    const getDocIcon = (type: string) => {
      switch (type) {
        case 'resume': return '👔';
        case 'cover_letter': return '✉️';
        case 'report': return '📊';
        case 'assignment': return '📝';
        case 'email': return '📧';
        case 'meeting_notes': return '📋';
        default: return '📄';
      }
    };

    return (
      <div className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-955">
        {/* Left Side: Saved Documents List */}
        <div className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Documents Workspace</h2>
              <button
                onClick={() => {
                  setActiveDocument({
                    id: 'new',
                    user_id: '',
                    title: 'New Document',
                    content: '',
                    type: 'resume',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  });
                  setDocTitleInput('New Document');
                  setDocContentInput('');
                  setSelectedDocType('resume');
                  setIsEditingDoc(true);
                }}
                className={`p-1.5 rounded-lg text-white hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer ${getThemeClasses(themePref).primary}`}
                title="Create New Document"
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Search documents..."
              value={docSearchQuery}
              onChange={e => setDocSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
            />
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {documentsLoading ? (
              <div className="space-y-1.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-full px-3 py-2.5 rounded-xl animate-pulse flex items-center justify-between">
                    <div className="flex items-center gap-2 w-3/4">
                      <div className="w-4 h-4 bg-slate-200 dark:bg-slate-800 rounded shrink-0"></div>
                      <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-405 dark:text-slate-500">
                No documents found.
              </div>
            ) : (
              filteredDocs.map(d => (
                <div
                  key={d.id}
                  onClick={() => {
                    setActiveDocument(d);
                    setDocTitleInput(d.title);
                    setDocContentInput(d.content);
                    setSelectedDocType(d.type);
                    setIsEditingDoc(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between group cursor-pointer ${
                    activeDocument?.id === d.id
                      ? 'bg-indigo-650/10 text-indigo-650 dark:bg-indigo-500/15 dark:text-indigo-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="text-base shrink-0">{getDocIcon(d.type)}</span>
                    <span className="text-xs truncate">{d.title}</span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteDocument(d.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-rose-500 transition-opacity cursor-pointer"
                    title="Delete Document"
                  >
                    <CloseIcon className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Document Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 relative">
          {!activeDocument ? (
            /* Empty State / Creation Wizard */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto space-y-6 relative w-full">
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setActiveTab('chat'); }}
                className="absolute top-2 right-2 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center w-8 h-8 font-bold text-xs"
                title="Close and return"
                aria-label="Close"
              >
                ✕
              </button>
              <div className="w-16 h-16 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center text-3xl">
                👔
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Document Studio Assistant</h3>
                <p className="text-xs text-slate-450 dark:text-slate-500 max-w-sm">
                  Choose a document type, enter details, and let the AI generate a customized professional copy template for you.
                </p>
              </div>
              
              <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805/85 rounded-2xl p-5 shadow-sm space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Document Type</label>
                  <select
                    value={selectedDocType}
                    onChange={e => setSelectedDocType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                  >
                    {docTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">AI Prompt Details</label>
                  <textarea
                    rows={4}
                    placeholder="E.g., Cover Letter for a Senior React Engineer position at Google, emphasizing my 5 years of typescript experience and leadership skills..."
                    value={docPromptInput}
                    onChange={e => setDocPromptInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-slate-805 dark:text-slate-100"
                  />
                </div>
                
                <button
                  disabled={isGeneratingDoc || !docPromptInput.trim()}
                  onClick={handleGenerateDocument}
                  className={`w-full py-2.5 text-white rounded-xl text-xs font-bold active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 ${getThemeClasses(themePref).primary}`}
                >
                  {isGeneratingDoc ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Generating Content...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 21l-.813-5.096L3 15l5.096-.813L9 9l.813 5.096L15 15l-5.187.904ZM18 10.5l-.5 3-.5-3-3-.5 3-.5.5-3 .5 3 3 .5-3 .5ZM19.07 19.07l-.355 2.13-.355-2.13-2.13-.355 2.13-.355.355-2.13.355 2.13 2.13.355-2.13.355Z" />
                      </svg>
                      Generate Document
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Document Editor & Preview split Workspace */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header bar */}
              <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setActiveDocument(null)}
                    className="p-1.5 rounded-lg text-slate-450 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                    title="Back to Catalog"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                    </svg>
                  </button>
                  <input
                    type="text"
                    value={docTitleInput}
                    onChange={e => {
                      setDocTitleInput(e.target.value);
                      setIsEditingDoc(true);
                    }}
                    className="bg-transparent text-sm font-extrabold text-slate-850 dark:text-white outline-none border-b border-transparent focus:border-indigo-500 px-1 py-0.5 truncate max-w-xs sm:max-w-md"
                  />
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-450 px-2 py-0.5 rounded font-bold uppercase shrink-0">
                    {activeDocument.type.replace('_', ' ')}
                  </span>
                  {isEditingDoc && (
                    <span className="text-[10px] text-amber-550 dark:text-amber-400 font-semibold italic animate-pulse shrink-0">
                      • Unsaved
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveDocument}
                    className={`px-3 py-1.5 text-white rounded-lg text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1 ${getThemeClasses(themePref).primary}`}
                    title="Save Changes"
                  >
                    Save
                  </button>
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); setActiveTab('chat'); }}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center w-7 h-7 font-bold text-xs shrink-0"
                    title="Close and return"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Workspace Content split */}
              <div className="flex-1 flex overflow-hidden">
                {/* Left Side: Markdown Editor */}
                <div className="w-1/2 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="p-2 border-b border-slate-150 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">
                    <span>Markdown Content Editor</span>
                    <span>Synchronizes Live</span>
                  </div>
                  <textarea
                    value={docContentInput}
                    onChange={e => {
                      setDocContentInput(e.target.value);
                      setIsEditingDoc(true);
                    }}
                    placeholder="Enter document content in Markdown format..."
                    className="flex-1 resize-none bg-transparent p-4 font-mono text-xs leading-relaxed outline-none text-slate-800 dark:text-slate-100 overflow-y-auto"
                  />
                </div>

                {/* Right Side: Live HTML Rendered Preview & Refiners */}
                <div className="w-1/2 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
                  <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Live Document Preview</span>
                    
                    {/* Exporters and Copy buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleCopyDocumentContent}
                        className={`p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                          copySuccess ? 'text-emerald-505 border-emerald-500/20 bg-emerald-500/5' : 'text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        title="Copy to Clipboard"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H5.25m11.9-3.675A2.01 2.01 0 0 0 16.5 3h-9a2.01 2.01 0 0 0-1.19 3.675M16.5 6a1.5 1.5 0 0 0-1.5-1.5h-9A1.5 1.5 0 0 0 4.5 6m12 0v13.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 19.5V6" />
                        </svg>
                        <span className="text-[10px]">{copySuccess ? "Copied!" : "Copy"}</span>
                      </button>
                      
                      <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>
                      
                      {/* Export format buttons */}
                      {activeDocument.id !== 'new' ? (
                        <div className="flex gap-1">
                          {['pdf', 'docx', 'txt', 'markdown'].map(fmt => (
                            <button
                              key={fmt}
                              onClick={() => handleExportDocument(activeDocument.id, fmt)}
                              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase rounded-lg text-slate-650 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              {fmt === 'markdown' ? 'MD' : fmt}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[9px] text-slate-400 italic">Save document first to download</span>
                      )}
                    </div>
                  </div>

                  {/* HTML Live Preview Render Area */}
                  <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl m-3 shadow-inner prose prose-sm dark:prose-invert max-w-none">
                    <div 
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(docContentInput) }} 
                      className="markdown-body text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans" 
                    />
                  </div>

                  {/* Refiners Actions Console Panel */}
                  <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 shrink-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                      AI Content refinement tools
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Left actions: grammar & summary */}
                      <div className="flex gap-1">
                        <button
                          disabled={refineActionActive || !docContentInput.trim()}
                          onClick={() => handleRefineDocument('improve_grammar')}
                          className="flex-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-650 hover:bg-indigo-500/20 dark:text-indigo-400 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                        >
                          👔 Improve Grammar
                        </button>
                        <button
                          disabled={refineActionActive || !docContentInput.trim()}
                          onClick={() => handleRefineDocument('summarize')}
                          className="flex-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-650 hover:bg-indigo-500/20 dark:text-indigo-400 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                        >
                          📊 Summarize
                        </button>
                      </div>

                            <div className="flex flex-col gap-1.5">
                        <div className="space-y-1.5">
                          <div className="flex gap-1.5 items-center">
                            <select
                              value={targetRewriteTone}
                              onChange={e => setTargetRewriteTone(e.target.value)}
                              className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-350 px-2 py-1.5 rounded-lg outline-none cursor-pointer"
                            >
                              <option value="professional">Professional</option>
                              <option value="formal">Formal</option>
                              <option value="friendly">Friendly</option>
                              <option value="casual">Casual</option>
                              <option value="polite">Polite</option>
                              <option value="confident">Confident</option>
                              <option value="concise">Concise</option>
                              <option value="detailed">Detailed</option>
                              <option value="academic">Academic</option>
                              <option value="creative">Creative</option>
                              <option value="persuasive">Persuasive</option>
                              <option value="empathetic">Empathetic</option>
                              <option value="journalistic">Journalistic</option>
                              <option value="social_media">Social Media</option>
                              <option value="ai_optimized">AI Optimized</option>
                              <option value="ats_resume">ATS Resume</option>
                              <option value="urgent">Urgent</option>
                              <option value="custom">Custom Style/Instruction...</option>
                            </select>
                            <button
                              disabled={isRewritingDoc || isTranslatingDoc || refineActionActive || !docContentInput.trim()}
                              onClick={handleRewriteToneDocument}
                              className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-655 hover:bg-indigo-500/20 dark:text-indigo-400 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1 shrink-0"
                            >
                              {isRewritingDoc ? (
                                <>
                                  <div className="w-2 h-2 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                  Rewriting...
                                </>
                              ) : (
                                "✍️ Rewrite"
                              )}
                            </button>
                          </div>
                          
                          {targetRewriteTone === 'custom' && (
                            <input
                              type="text"
                              value={customToneInstruction}
                              onChange={e => setCustomToneInstruction(e.target.value)}
                              placeholder="e.g. Explain in simple English, marketing style"
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10px] px-2 py-1.5 rounded-lg outline-none placeholder-slate-400 dark:placeholder-slate-600 focus:border-indigo-500 transition-colors"
                            />
                          )}
                        </div>
                        
                        <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800/60 pt-2 mt-1.5">
                          <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 dark:text-slate-500">
                            <span>FROM:</span>
                            <select
                              value={sourceTranslateLang}
                              onChange={e => setSourceTranslateLang(e.target.value)}
                              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[9px] font-semibold text-slate-700 dark:text-slate-350 px-1.5 py-1 rounded outline-none cursor-pointer"
                            >
                              <option value="auto">Auto Detect</option>
                              <option value="English">English</option>
                              <option value="Hindi">Hindi</option>
                              <option value="Spanish">Spanish</option>
                              <option value="French">French</option>
                              <option value="German">German</option>
                              <option value="Italian">Italian</option>
                              <option value="Portuguese">Portuguese</option>
                              <option value="Russian">Russian</option>
                              <option value="Japanese">Japanese</option>
                              <option value="Korean">Korean</option>
                              <option value="Chinese (Simplified)">Chinese</option>
                              <option value="Arabic">Arabic</option>
                            </select>
                            
                            <span>TO:</span>
                            <select
                              value={targetTranslateLang}
                              onChange={e => setTargetTranslateLang(e.target.value)}
                              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[9px] font-semibold text-slate-700 dark:text-slate-350 px-1.5 py-1 rounded outline-none cursor-pointer"
                            >
                              <option value="English">English</option>
                              <option value="Hindi">Hindi</option>
                              <option value="Spanish">Spanish</option>
                              <option value="French">French</option>
                              <option value="German">German</option>
                              <option value="Italian">Italian</option>
                              <option value="Portuguese">Portuguese</option>
                              <option value="Russian">Russian</option>
                              <option value="Japanese">Japanese</option>
                              <option value="Korean">Korean</option>
                              <option value="Chinese (Simplified)">Chinese (Simplified)</option>
                              <option value="Arabic">Arabic</option>
                            </select>
                          </div>
                          
                          <button
                            disabled={isTranslatingDoc || refineActionActive || !docContentInput.trim()}
                            onClick={handleTranslateDocument}
                            className="w-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-655 hover:bg-indigo-500/20 dark:text-indigo-400 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            {isTranslatingDoc ? (
                              <>
                                <div className="w-2.5 h-2.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                Translating...
                              </>
                            ) : (
                              "🌐 Translate Document"
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {refineActionActive && (
                      <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-2 animate-pulse text-center">
                        AI Content Assistant refining text. Please hold...
                      </div>
                    )}
                    
                    {isTranslatingDoc && (
                      <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-2 animate-pulse text-center">
                        AI Multilingual Translation system translating document. Please hold...
                      </div>
                    )}
                    
                    {isRewritingDoc && (
                      <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-2 animate-pulse text-center">
                        AI Writing Assistant rewriting document style. Please hold...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAdminPage = () => {
    const handleUpdateUserRole = (userId: string, newRole: string) => {
      if (!user) return;
      fetch(`${apiUrl}/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ role: newRole })
      })
        .then(res => {
          if (!res.ok) return res.json().then(e => { throw new Error(e.detail || "Failed to update role") });
          return res.json();
        })
        .then(() => {
          fetchAdminUsers();
          fetchAdminStats();
          fetchAuditLogs();
        })
        .catch(err => alert(err.message));
    };

    const handleDeleteUser = (userId: string) => {
      if (!user) return;
      if (!window.confirm("Are you sure you want to permanently delete this user account? This cannot be undone.")) return;
      fetch(`${apiUrl}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      })
        .then(res => {
          if (!res.ok) return res.json().then(e => { throw new Error(e.detail || "Failed to delete user") });
          return res.json();
        })
        .then(() => {
          fetchAdminUsers();
          fetchAdminStats();
          fetchAuditLogs();
        })
        .catch(err => alert(err.message));
    };

    const handleSendAnnouncement = (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      if (!announcementTitle.trim() || !announcementMessage.trim()) {
        setAnnouncementError("Title and message are required.");
        return;
      }
      setIsSendingAnnouncement(true);
      setAnnouncementSuccess(null);
      setAnnouncementError(null);
      
      fetch(`${apiUrl}/api/admin/announcement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          title: announcementTitle.trim(),
          message: announcementMessage.trim(),
          priority: announcementPriority
        })
      })
        .then(res => {
          if (!res.ok) return res.json().then(e => { throw new Error(e.detail || "Failed to send announcement") });
          return res.json();
        })
        .then(() => {
          setAnnouncementSuccess("Announcement successfully sent to all users!");
          setAnnouncementTitle("");
          setAnnouncementMessage("");
          setAnnouncementPriority("normal");
          fetchAdminStats();
          fetchAuditLogs();
        })
        .catch(err => setAnnouncementError(err.message))
        .finally(() => setIsSendingAnnouncement(false));
    };

    const handleSaveSettings = (updatedKeys: any) => {
      if (!user) return;
      setIsSavingSettings(true);
      fetch(`${apiUrl}/api/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(updatedKeys)
      })
        .then(res => res.json())
        .then(data => {
          setAdminSettings(data.settings);
          fetchAuditLogs();
        })
        .catch(err => console.error("Error saving settings:", err))
        .finally(() => setIsSavingSettings(false));
    };

    const handleClearErrors = () => {
      if (!user) return;
      fetch(`${apiUrl}/api/admin/errors/clear`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user.token}` }
      })
        .then(res => res.json())
        .then(() => {
          setSystemErrors([]);
          fetchAdminStats();
          fetchAuditLogs();
        })
        .catch(err => console.error("Error clearing errors:", err));
    };

    const handleSimulateError = () => {
      if (!user) return;
      fetch(`${apiUrl}/api/admin/errors/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          error_type: "DatabaseTimeoutException",
          message: "Simulated warning: Postgres transaction latency exceeds 500ms."
        })
      })
        .then(res => res.json())
        .then(() => {
          fetchSystemErrors();
          fetchAdminStats();
        })
        .catch(err => console.error("Error simulating error:", err));
    };

    const sections = [
      { id: 'dashboard', label: '📊 Dashboard' },
      { id: 'users', label: '👥 Users' },
      { id: 'usage', label: '🤖 AI Usage' },
      { id: 'subscription', label: '💳 Subscription' },
      { id: 'announcements', label: '🔔 Announcements' },
      { id: 'storage', label: '📁 Files / Storage' },
      { id: 'settings', label: '⚙️ System Settings' },
      { id: 'logs', label: '📝 Activity / Audit Logs' },
      { id: 'errors', label: '🚨 Errors / Failed Jobs' },
      { id: 'security', label: '🛡️ Security' }
    ];

    return (
      <div className="flex-1 flex min-h-0 overflow-hidden relative bg-white dark:bg-slate-955 h-[calc(100vh-4rem)]">
        {/* Admin Left Sidebar */}
        <div className="w-64 border-r border-slate-200 dark:border-slate-805 flex flex-col bg-slate-50/50 dark:bg-slate-900/30 overflow-y-auto shrink-0 p-4 space-y-1.5">
          <div className="px-3 py-2">
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
              Control Center
            </span>
          </div>
          {sections.map(sec => (
            <button
              key={sec.id}
              onClick={() => handleAdminSectionChange(sec.id)}
              className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeAdminSection === sec.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-650/10'
                  : 'text-slate-655 hover:bg-slate-100 dark:text-slate-350 dark:hover:bg-slate-800/80'
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>

        {/* Admin Content Pane */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-slate-950">
          {/* Header */}
          <div className="h-14 border-b border-slate-200 dark:border-slate-800/60 px-6 flex items-center justify-between shrink-0 bg-slate-50/20 dark:bg-slate-900/10">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full uppercase tracking-wide">
                Admin
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100 capitalize">
                {activeAdminSection.replace('_', ' ')} Overview
              </span>
            </div>
            <button
              onClick={() => setActiveTab('chat')}
              className="p-1.5 rounded-lg text-slate-455 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Close Admin Panel"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Main Area */}
          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            {/* Dashboard Section */}
            {activeAdminSection === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Users</span>
                    <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-1 block">
                      {adminStats?.users_count ?? '...'}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Chats</span>
                    <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-1 block">
                      {adminStats?.chats_count ?? '...'}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Messages</span>
                    <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-1 block">
                      {adminStats?.messages_count ?? '...'}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">System Warnings</span>
                    <span className={`text-2xl font-extrabold mt-1 block ${adminStats?.system_errors_count > 0 ? 'text-amber-500' : 'text-slate-805 dark:text-slate-100'}`}>
                      {adminStats?.system_errors_count ?? '...'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Quick Actions & Health</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-950 p-4 border border-slate-200/40 dark:border-slate-850 rounded-2xl">
                      <h4 className="text-xs font-bold text-slate-750 dark:text-slate-200 mb-2">Role Management</h4>
                      <p className="text-[10px] text-slate-450 leading-relaxed mb-4">
                        Promote normal users to admin privilege levels or deactivate access. Admin status yields backend router configuration control.
                      </p>
                      <button onClick={() => handleAdminSectionChange('users')} className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer">
                        Manage Users
                      </button>
                    </div>

                    <div className="bg-white dark:bg-slate-950 p-4 border border-slate-200/40 dark:border-slate-850 rounded-2xl">
                      <h4 className="text-xs font-bold text-slate-750 dark:text-slate-200 mb-2">Error simulation</h4>
                      <p className="text-[10px] text-slate-450 leading-relaxed mb-4">
                        Simulate background thread exception loops or warn triggers. Test if notification dispatches function properly.
                      </p>
                      <button onClick={handleSimulateError} className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-650 dark:text-rose-400 text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer">
                        Simulate Warning
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Users Section */}
            {activeAdminSection === 'users' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active User Catalog</h3>
                  <button onClick={fetchAdminUsers} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">
                    Refresh List
                  </button>
                </div>
                <div className="border border-slate-200/60 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                        <th className="p-3.5 pl-5">User Details</th>
                        <th className="p-3.5">Subscription</th>
                        <th className="p-3.5">Role Privilege</th>
                        <th className="p-3.5 pr-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-900 bg-white dark:bg-slate-955">
                      {adminUsers.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                          <td className="p-3.5 pl-5">
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">{u.name}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5 block">{u.email}</span>
                          </td>
                          <td className="p-3.5 font-medium text-slate-655 dark:text-slate-350">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              u.account_type?.toLowerCase().includes('pro')
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {u.account_type || 'Free Plan'}
                            </span>
                          </td>
                          <td className="p-3.5 font-bold">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] ${
                              u.role === 'admin'
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-550'
                            }`}>
                              {u.role || 'user'}
                            </span>
                          </td>
                          <td className="p-3.5 pr-5 text-right space-x-2">
                            {u.id !== user?.id ? (
                              <>
                                <button
                                  onClick={() => handleUpdateUserRole(u.id, u.role === 'admin' ? 'user' : 'admin')}
                                  className="text-[10px] font-bold text-indigo-650 hover:underline cursor-pointer"
                                >
                                  {u.role === 'admin' ? 'Demote' : 'Promote'}
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                                >
                                  Delete
                                </button>
                              </>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Self (Protected)</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* AI Usage Section */}
            {activeAdminSection === 'usage' && (
              <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Total Chat Volume</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200/40 dark:border-slate-850">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Sessions Active</span>
                      <span className="text-3xl font-extrabold text-slate-805 dark:text-slate-100 mt-1 block">
                        {adminStats?.chats_count ?? 0}
                      </span>
                    </div>
                    <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200/40 dark:border-slate-850">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Messages Transmitted</span>
                      <span className="text-3xl font-extrabold text-slate-805 dark:text-slate-100 mt-1 block">
                        {adminStats?.messages_count ?? 0}
                      </span>
                    </div>
                    <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200/40 dark:border-slate-850">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Avg. Messages per session</span>
                      <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1 block">
                        {adminStats?.chats_count > 0 ? (adminStats.messages_count / adminStats.chats_count).toFixed(1) : '0.0'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Model configurations</h3>
                  <p className="text-[10px] text-slate-455 mb-4">Current primary and backup language models configured for natural language interactions.</p>
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-xs py-2 border-b border-slate-200/40 dark:border-slate-800/40">
                      <span className="font-semibold text-slate-655 dark:text-slate-350">Active Model</span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">{adminSettings?.ai_model_version ?? 'gemini-2.0-flash'}</span>
                    </div>
                    <div className="flex justify-between text-xs py-2 border-b border-slate-200/40 dark:border-slate-800/40">
                      <span className="font-semibold text-slate-655 dark:text-slate-350">Fallback Mode</span>
                      <span className="text-emerald-500 font-semibold">Enabled (Local Mock Engine)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Announcements Section */}
            {activeAdminSection === 'announcements' && (
              <div className="max-w-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Broadcaster System Announcements</h3>
                <form onSubmit={handleSendAnnouncement} className="space-y-4">
                  {announcementSuccess && (
                    <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-650 dark:text-emerald-400 rounded-xl text-xs font-bold">
                      {announcementSuccess}
                    </div>
                  )}
                  {announcementError && (
                    <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold">
                      {announcementError}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Announcement Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Scheduled Maintenance"
                      value={announcementTitle}
                      onChange={(e) => setAnnouncementTitle(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-3.5 py-2.5 text-xs rounded-xl outline-none border border-slate-200 dark:border-slate-800 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Message Content</label>
                    <textarea
                      rows={4}
                      placeholder="Enter announcement description..."
                      value={announcementMessage}
                      onChange={(e) => setAnnouncementMessage(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-3.5 py-2.5 text-xs rounded-xl outline-none border border-slate-200 dark:border-slate-800 focus:ring-1 focus:ring-indigo-500 resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Notification Priority</label>
                    <select
                      value={announcementPriority}
                      onChange={(e) => setAnnouncementPriority(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-3.5 py-2.5 text-xs rounded-xl outline-none border border-slate-200 dark:border-slate-800 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="normal">Normal Priority</option>
                      <option value="important">High/Important Priority</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isSendingAnnouncement}
                    className="w-full bg-indigo-600 hover:bg-indigo-650 text-white text-xs font-bold py-3 px-4 rounded-xl cursor-pointer transition-all disabled:opacity-50"
                  >
                    {isSendingAnnouncement ? 'Broadcasting announcement...' : 'Broadcast Announcement'}
                  </button>
                </form>
              </div>
            )}

            {/* Storage Section */}
            {activeAdminSection === 'storage' && (
              <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">System File Catalog</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200/40 dark:border-slate-850">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Total Documents</span>
                      <span className="text-3xl font-extrabold text-slate-805 dark:text-slate-100 mt-1 block">
                        {adminStats?.documents_count ?? 0}
                      </span>
                    </div>
                    <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200/40 dark:border-slate-850">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Uploaded Temp Files</span>
                      <span className="text-3xl font-extrabold text-slate-805 dark:text-slate-100 mt-1 block">
                        {adminStats?.temp_uploads_count ?? 0}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Total Size: {adminStats?.temp_uploads_size_bytes ? (adminStats.temp_uploads_size_bytes / (1024 * 1024)).toFixed(2) : '0.00'} MB
                      </span>
                    </div>
                    <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200/40 dark:border-slate-850">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Generated Image Assets</span>
                      <span className="text-3xl font-extrabold text-slate-805 dark:text-slate-100 mt-1 block">
                        {adminStats?.generated_images_count ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* System Settings Section */}
            {activeAdminSection === 'settings' && (
              <div className="max-w-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Core System Configurations</h3>
                {adminSettings ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200/40 dark:border-slate-850">
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">Maintenance Mode</span>
                        <span className="text-[10px] text-slate-455 mt-0.5 block">Restrict application features for public users when active.</span>
                      </div>
                      <button
                        onClick={() => handleSaveSettings({ maintenance_mode: !adminSettings.maintenance_mode })}
                        disabled={isSavingSettings}
                        className={`text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer ${
                          adminSettings.maintenance_mode
                            ? 'bg-rose-500 text-white hover:bg-rose-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {adminSettings.maintenance_mode ? 'Deactivate Maintenance' : 'Activate Maintenance'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200/40 dark:border-slate-850">
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">Google OAuth integrations</span>
                        <span className="text-[10px] text-slate-455 mt-0.5 block">Enable/disable external login routes.</span>
                      </div>
                      <button
                        onClick={() => handleSaveSettings({ google_oauth_enabled: !adminSettings.google_oauth_enabled })}
                        disabled={isSavingSettings}
                        className={`text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer ${
                          adminSettings.google_oauth_enabled
                            ? 'bg-indigo-650 text-white hover:bg-indigo-650'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {adminSettings.google_oauth_enabled ? 'Disable Google OAuth' : 'Enable Google OAuth'}
                      </button>
                    </div>

                    <div className="p-3.5 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200/40 dark:border-slate-850 space-y-4">
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">Token limit defaults</span>
                        <span className="text-[10px] text-slate-455 mt-0.5 block">Set standard transaction message threshold sizes.</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={adminSettings.default_token_limit}
                          onChange={(e) => setAdminSettings({ ...adminSettings, default_token_limit: parseInt(e.target.value) || 0 })}
                          className="w-full bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 px-3 py-2 text-xs rounded-xl outline-none border border-slate-200 dark:border-slate-800 focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          onClick={() => handleSaveSettings({ default_token_limit: adminSettings.default_token_limit })}
                          disabled={isSavingSettings}
                          className="bg-indigo-600 hover:bg-indigo-650 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-455 animate-pulse">Loading settings...</span>
                )}
              </div>
            )}

            {/* Audit Logs Section */}
            {activeAdminSection === 'logs' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Audit logs catalog</h3>
                  <button onClick={fetchAuditLogs} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">
                    Refresh
                  </button>
                </div>
                <div className="border border-slate-200/60 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                        <th className="p-3.5 pl-5">Timestamp</th>
                        <th className="p-3.5">Actor</th>
                        <th className="p-3.5">Action Type</th>
                        <th className="p-3.5 pr-5">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-900 bg-white dark:bg-slate-955">
                      {auditLogs.length > 0 ? (
                        auditLogs.map(l => (
                          <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                            <td className="p-3.5 pl-5 font-mono text-[10px] text-slate-450 shrink-0">
                              {new Date(l.timestamp).toLocaleString()}
                            </td>
                            <td className="p-3.5 font-semibold text-slate-700 dark:text-slate-350">{l.performed_by}</td>
                            <td className="p-3.5">
                              <span className="px-2 py-0.5 rounded-full text-[9px] bg-indigo-50 text-indigo-650 dark:bg-indigo-505/10 dark:text-indigo-400 font-bold uppercase tracking-wider">
                                {l.action}
                              </span>
                            </td>
                            <td className="p-3.5 pr-5 text-slate-655 dark:text-slate-400">{l.details}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-slate-450 italic">
                            No admin audit logs recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* System Errors Section */}
            {activeAdminSection === 'errors' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active System Warning/Error Traces</h3>
                  <div className="space-x-3">
                    <button onClick={handleSimulateError} className="text-[10px] font-bold text-amber-500 cursor-pointer">
                      Simulate Warn
                    </button>
                    <button onClick={handleClearErrors} className="text-[10px] font-bold text-rose-500 cursor-pointer">
                      Clear Logs
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {systemErrors.length > 0 ? (
                    systemErrors.map(err => (
                      <div key={err.id} className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl flex flex-col space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                              {err.error_type}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">{new Date(err.timestamp).toLocaleString()}</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-200 font-semibold leading-relaxed">
                          {err.message}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 bg-slate-50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center text-slate-450 italic">
                      Zero compile/runtime exceptions recorded. System fully healthy.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Security Section */}
            {activeAdminSection === 'security' && (
              <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Privileged Credentials Health</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200/40 dark:border-slate-850">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Authorized Admin Accounts</span>
                      <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1 block">
                        {adminStats?.roles_distribution?.['admin'] ?? 0}
                      </span>
                    </div>
                    <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200/40 dark:border-slate-850">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Session Protection Duration</span>
                      <span className="text-3xl font-extrabold text-slate-805 dark:text-slate-100 mt-1 block">
                        24 Hours
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Subscription Section */}
            {activeAdminSection === 'subscription' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Subscription Configuration</h3>
                  <button
                    onClick={() => {
                      if (adminSubConfig) {
                        setShowPreviewModal(true);
                      }
                    }}
                    className="px-4 py-2 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-650/15 cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <span>🔍 Preview Subscription Page</span>
                  </button>
                </div>

                {subConfigSuccess && (
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-450 rounded-xl text-xs font-bold animate-fade-in">
                    {subConfigSuccess}
                  </div>
                )}
                {subConfigError && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold animate-fade-in">
                    {subConfigError}
                  </div>
                )}

                {adminSubConfig ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Form Settings (7 cols) */}
                    <div className="lg:col-span-7 space-y-5">
                      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-5 space-y-4">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Plan Information</span>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-455 uppercase">Plan Name</label>
                            <input
                              type="text"
                              value={adminSubConfig.plan_name}
                              onChange={(e) => setAdminSubConfig({ ...adminSubConfig, plan_name: e.target.value })}
                              className="w-full bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 px-3 py-2 text-xs rounded-xl outline-none border border-slate-205 dark:border-slate-800 focus:ring-1 focus:ring-indigo-500 font-medium"
                              placeholder="e.g. AI Mega Assistant Plus"
                            />
                          </div>
                          
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-455 uppercase">Monthly Price (₹)</label>
                            <input
                              type="number"
                              value={adminSubConfig.monthly_price}
                              onChange={(e) => setAdminSubConfig({ ...adminSubConfig, monthly_price: parseInt(e.target.value) || 0 })}
                              className="w-full bg-white dark:bg-slate-955 text-slate-800 dark:text-slate-100 px-3 py-2 text-xs rounded-xl outline-none border border-slate-205 dark:border-slate-800 focus:ring-1 focus:ring-indigo-500 font-medium"
                              placeholder="e.g. 899"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-5 space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Trial & Promotion Settings</span>
                          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={adminSubConfig.trial_enabled}
                              onChange={(e) => setAdminSubConfig({ ...adminSubConfig, trial_enabled: e.target.checked })}
                              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                            />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-350">Enable Trial</span>
                          </label>
                        </div>

                        {adminSubConfig.trial_enabled && (
                          <div className="space-y-4 animate-fade-in">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-455 uppercase">Trial Duration</label>
                                <select
                                  value={adminSubConfig.trial_duration}
                                  onChange={(e) => setAdminSubConfig({ ...adminSubConfig, trial_duration: e.target.value })}
                                  className="w-full bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 px-3 py-2 text-xs rounded-xl outline-none border border-slate-205 dark:border-slate-800 focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
                                >
                                  <option value="7 days">7 days</option>
                                  <option value="14 days">14 days</option>
                                  <option value="1 month">1 month</option>
                                  <option value="3 months">3 months</option>
                                </select>
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-455 uppercase">Promotional Price (₹)</label>
                                <input
                                  type="number"
                                  value={adminSubConfig.promo_price}
                                  onChange={(e) => setAdminSubConfig({ ...adminSubConfig, promo_price: parseInt(e.target.value) || 0 })}
                                  className="w-full bg-white dark:bg-slate-955 text-slate-800 dark:text-slate-100 px-3 py-2 text-xs rounded-xl outline-none border border-slate-205 dark:border-slate-800 focus:ring-1 focus:ring-indigo-500 font-medium"
                                  placeholder="e.g. 0"
                                />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-455 uppercase">Offer Heading</label>
                              <input
                                type="text"
                                value={adminSubConfig.offer_heading}
                                onChange={(e) => setAdminSubConfig({ ...adminSubConfig, offer_heading: e.target.value })}
                                className="w-full bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 px-3 py-2 text-xs rounded-xl outline-none border border-slate-205 dark:border-slate-800 focus:ring-1 focus:ring-indigo-500 font-medium"
                                placeholder="e.g. TRY PLUS FREE FOR 1 MONTH"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-455 uppercase">Offer Description</label>
                              <textarea
                                value={adminSubConfig.offer_description}
                                onChange={(e) => setAdminSubConfig({ ...adminSubConfig, offer_description: e.target.value })}
                                rows={2}
                                className="w-full bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 px-3 py-2 text-xs rounded-xl outline-none border border-slate-205 dark:border-slate-800 focus:ring-1 focus:ring-indigo-500 font-medium"
                                placeholder="Description of the promo/trial..."
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-5 space-y-4">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block font-sans">Offer Status</span>
                        
                        <div className="flex items-center gap-6">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="offer_active"
                              checked={adminSubConfig.offer_active === true}
                              onChange={() => setAdminSubConfig({ ...adminSubConfig, offer_active: true })}
                              className="w-4 h-4 text-indigo-650 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Active (Visible to eligible users)</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="offer_active"
                              checked={adminSubConfig.offer_active === false}
                              onChange={() => setAdminSubConfig({ ...adminSubConfig, offer_active: false })}
                              className="w-4 h-4 text-indigo-650 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Inactive</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            if (!adminSubConfig) return;
                            setIsSavingSubConfig(true);
                            setSubConfigSuccess(null);
                            setSubConfigError(null);
                            
                            // Validations
                            if (!adminSubConfig.plan_name.trim()) {
                              setSubConfigError("Plan Name cannot be empty.");
                              setIsSavingSubConfig(false);
                              return;
                            }
                            if (adminSubConfig.monthly_price <= 0) {
                              setSubConfigError("Monthly Price must be greater than zero.");
                              setIsSavingSubConfig(false);
                              return;
                            }
                            if (adminSubConfig.features.length === 0) {
                              setSubConfigError("Features list must have at least one feature.");
                              setIsSavingSubConfig(false);
                              return;
                            }
                            if (adminSubConfig.trial_enabled && !adminSubConfig.offer_heading.trim()) {
                              setSubConfigError("Offer Heading cannot be empty when trial is enabled.");
                              setIsSavingSubConfig(false);
                              return;
                            }
                            
                            fetch(`${apiUrl}/api/admin/subscription/config`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${user.token}`
                              },
                              body: JSON.stringify(adminSubConfig)
                            })
                              .then(res => {
                                if (!res.ok) return res.json().then(e => { throw new Error(e.detail || "Failed to update configuration") });
                                return res.json();
                              })
                              .then(data => {
                                setAdminSubConfig(data.config);
                                setSubConfigSuccess("Subscription settings updated successfully.");
                                fetchAuditLogs();
                                fetchPlans(); // Refetch the pricing options for the client view
                                setTimeout(() => setSubConfigSuccess(null), 3000);
                              })
                              .catch(err => setSubConfigError(err.message))
                              .finally(() => setIsSavingSubConfig(false));
                          }}
                          disabled={isSavingSubConfig}
                          className="px-6 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-650/10 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                        >
                          {isSavingSubConfig ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </div>

                    {/* Right Column: Plus Feature List Manager (5 cols) */}
                    <div className="lg:col-span-5 space-y-5">
                      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-5 space-y-4">
                        <div>
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block font-sans">Plus Feature List</span>
                          <span className="text-[9px] text-slate-455 mt-0.5 block">Configure the benefits displayed on the pricing card.</span>
                        </div>

                        {/* Add Feature block */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newFeatureText}
                            onChange={(e) => setNewFeatureText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (newFeatureText.trim()) {
                                  setAdminSubConfig({
                                    ...adminSubConfig,
                                    features: [...adminSubConfig.features, newFeatureText.trim()]
                                  });
                                  setNewFeatureText("");
                                }
                              }
                            }}
                            className="flex-1 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 px-3 py-1.5 text-xs rounded-xl outline-none border border-slate-205 dark:border-slate-800 focus:ring-1 focus:ring-indigo-500"
                            placeholder="Add new feature..."
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (newFeatureText.trim()) {
                                setAdminSubConfig({
                                  ...adminSubConfig,
                                  features: [...adminSubConfig.features, newFeatureText.trim()]
                                });
                                setNewFeatureText("");
                              }
                            }}
                            className="bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl px-3 text-xs font-bold cursor-pointer"
                          >
                            Add
                          </button>
                        </div>

                        {/* Features List */}
                        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                          {adminSubConfig.features.map((feat: string, index: number) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-950 border border-slate-202/40 dark:border-slate-850 rounded-xl gap-2"
                            >
                              {editingFeatureIndex === index ? (
                                <div className="flex-1 flex gap-1.5 items-center">
                                  <input
                                    type="text"
                                    value={editingFeatureText}
                                    onChange={(e) => setEditingFeatureText(e.target.value)}
                                    className="flex-1 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-2 py-1 text-xs rounded-lg outline-none border border-slate-205 dark:border-slate-800"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (editingFeatureText.trim()) {
                                        const updatedFeats = [...adminSubConfig.features];
                                        updatedFeats[index] = editingFeatureText.trim();
                                        setAdminSubConfig({ ...adminSubConfig, features: updatedFeats });
                                        setEditingFeatureIndex(null);
                                      }
                                    }}
                                    className="text-[10px] font-bold text-indigo-650 cursor-pointer"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingFeatureIndex(null)}
                                    className="text-[10px] font-bold text-slate-400 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="text-xs text-slate-750 dark:text-slate-300 font-medium truncate flex-1">{feat}</span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {/* Move Up */}
                                    <button
                                      type="button"
                                      disabled={index === 0}
                                      onClick={() => {
                                        if (index > 0) {
                                          const updatedFeats = [...adminSubConfig.features];
                                          const temp = updatedFeats[index];
                                          updatedFeats[index] = updatedFeats[index - 1];
                                          updatedFeats[index - 1] = temp;
                                          setAdminSubConfig({ ...adminSubConfig, features: updatedFeats });
                                        }
                                      }}
                                      className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 cursor-pointer"
                                      title="Move Up"
                                    >
                                      ▲
                                    </button>
                                    {/* Move Down */}
                                    <button
                                      type="button"
                                      disabled={index === adminSubConfig.features.length - 1}
                                      onClick={() => {
                                        if (index < adminSubConfig.features.length - 1) {
                                          const updatedFeats = [...adminSubConfig.features];
                                          const temp = updatedFeats[index];
                                          updatedFeats[index] = updatedFeats[index + 1];
                                          updatedFeats[index + 1] = temp;
                                          setAdminSubConfig({ ...adminSubConfig, features: updatedFeats });
                                        }
                                      }}
                                      className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 cursor-pointer"
                                      title="Move Down"
                                    >
                                      ▼
                                    </button>
                                    {/* Edit */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingFeatureIndex(index);
                                        setEditingFeatureText(feat);
                                      }}
                                      className="text-[10px] font-bold text-slate-455 hover:text-indigo-650 cursor-pointer"
                                    >
                                      Edit
                                    </button>
                                    {/* Delete */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updatedFeats = adminSubConfig.features.filter((_: any, fi: number) => fi !== index);
                                        setAdminSubConfig({ ...adminSubConfig, features: updatedFeats });
                                      }}
                                      className="text-[10px] font-bold text-rose-500 cursor-pointer"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-455 animate-pulse">Loading subscription settings...</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Preview Subscription Page Modal Mockup */}
        {showPreviewModal && adminSubConfig && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-5xl bg-slate-955 text-slate-100 rounded-3xl shadow-2xl p-6 md:p-8 space-y-6 animate-in zoom-in-95 duration-200 relative border border-slate-800">
              
              <button
                onClick={() => setShowPreviewModal(false)}
                className="absolute top-5 right-5 p-2 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer shadow-md"
                title="Close preview"
              >
                ✕
              </button>

              <div className="border-b border-slate-900 pb-4">
                <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Unsaved Preview Mode</span>
                <h2 className="text-xl md:text-2xl font-extrabold text-white mt-2">Subscription Page Preview</h2>
                <p className="text-xs text-slate-400">Verifying prices, trials, features, and active promotions.</p>
              </div>

              {/* Promo Banner Preview */}
              {adminSubConfig.trial_enabled && adminSubConfig.offer_active && (
                <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <span className="inline-block bg-indigo-600 text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider w-fit">
                      {adminSubConfig.offer_heading}
                    </span>
                    <span className="text-xs font-semibold text-slate-200">
                      {adminSubConfig.offer_description}
                    </span>
                  </div>
                  <button disabled className="bg-indigo-600/40 text-slate-355 text-xs font-extrabold px-5 py-2.5 rounded-xl cursor-not-allowed">
                    Claim Free Offer
                  </button>
                </div>
              )}

              {/* Pricing Cards Grid Preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 max-w-3xl mx-auto justify-center">
                {/* Free Card */}
                <div className="flex flex-col p-6 rounded-3xl border border-slate-800 bg-slate-900 justify-between min-h-[460px]">
                  <div>
                    <div className="mb-4">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Free</span>
                      <h3 className="text-base font-bold text-white mt-1.5">Get started with AI Mega Assistant</h3>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed min-h-[48px]">
                        Explore AI assistance for everyday questions, learning, coding and productivity.
                      </p>
                    </div>
                    <div className="my-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-white">₹0</span>
                        <span className="text-xs text-slate-400 font-semibold flex items-center">/ month</span>
                      </div>
                    </div>
                    <button disabled className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-800 text-slate-500 border-slate-750 cursor-not-allowed">
                      Your current plan
                    </button>
                    <div className="mt-2 space-y-2.5">
                      {["Core AI model", "Limited messages and uploads", "Limited image creation", "Basic memory", "Basic AI tools", "Standard response speed"].map((feat, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-350">
                          <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Plus Card */}
                <div className="relative flex flex-col p-6 rounded-3xl border-2 border-indigo-500/80 bg-gradient-to-b from-indigo-950/20 via-slate-900/80 to-slate-900/80 justify-between min-h-[460px]">
                  {adminSubConfig.trial_enabled && adminSubConfig.offer_active && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[9px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest whitespace-nowrap shadow-sm">
                      LIMITED TIME
                    </div>
                  )}
                  <div>
                    <div className="mb-4">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{adminSubConfig.plan_name}</span>
                      <h3 className="text-base font-bold text-white mt-1.5">Your advanced AI assistant</h3>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed min-h-[48px]">
                        Unlock advanced intelligence for coding, research, creativity and productivity.
                      </p>
                    </div>
                    <div className="my-4">
                      {adminSubConfig.trial_enabled && adminSubConfig.offer_active ? (
                        <>
                          <div className="text-[11.5px] font-bold text-slate-400 line-through mb-0.5">₹{adminSubConfig.monthly_price} / month</div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-3xl font-black text-white">₹{adminSubConfig.promo_price}</span>
                            <span className="text-xs text-slate-400 font-semibold">/ month</span>
                          </div>
                          <div className="text-xs text-emerald-400 font-bold mt-1">Try Plus free for {adminSubConfig.trial_duration}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 font-medium">After trial: ₹{adminSubConfig.monthly_price} / month</div>
                        </>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-white">₹{adminSubConfig.monthly_price}</span>
                          <span className="text-xs text-slate-400 font-semibold flex items-center">/ month</span>
                        </div>
                      )}
                    </div>
                    <button disabled className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-indigo-600/40 text-slate-350 cursor-not-allowed">
                      {adminSubConfig.trial_enabled && adminSubConfig.offer_active ? 'Claim Free Offer' : 'Upgrade to Plus'}
                    </button>
                    <div className="mt-2 space-y-2.5">
                      {adminSubConfig.features.map((feat: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-355">
                          <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };



  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const executeCheckout = (planId: string, billingCycle: string, paymentMethod: string, isPromo: boolean) => {
    if (!user) return;
    console.log("Initializing checkout", planId, billingCycle, paymentMethod, isPromo);
    setCheckoutProcessing(true);
    setCheckoutError(null);
    setCheckoutSuccess(false);

    fetch(`${apiUrl}/api/payments/create-verification-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify({
        plan_id: planId,
        billing_cycle: billingCycle
      })
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Failed to create checkout order on the backend.");
        }
        return data;
      })
      .then(async (data) => {
        if (data.payment_mode === 'demo') {
          setDemoProgress("Processing payment...");
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          if (simulateFailure) {
            setDemoProgress(null);
            throw new Error("Payment failed. (Simulated failure)");
          }
          
          setDemoProgress("Payment verification successful. Simulated verification amount: ₹1");
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          setDemoProgress("Refund processed. ₹1 refunded");
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          setDemoProgress("Plus trial activating...");
          
          const verifyRes = await fetch(`${apiUrl}/api/payments/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({
              razorpay_payment_id: `pay_demo_${Math.random().toString(36).substring(7)}`,
              razorpay_order_id: data.order_id,
              razorpay_signature: "sig_demo_success",
              plan_id: planId,
              billing_cycle: billingCycle,
              is_promo: isPromo
            })
          });
          
          const verifyData = await verifyRes.json();
          if (!verifyRes.ok) {
            throw new Error(verifyData.detail || "Payment verification failed. Your Plus trial was not activated.");
          }
          
          setDemoProgress(null);
          setCheckoutSuccess(true);
          fetchSubscription(user.token);
          return;
        }

        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          throw new Error("Failed to load Razorpay SDK. Please check your internet connection.");
        }

        const options = {
          key: data.key_id,
          amount: data.amount,
          currency: data.currency,
          name: "AI Mega Assistant",
          description: isPromo ? "Trial Verification Payment" : "Subscription Payment",
          order_id: data.order_id,
          handler: function (response: any) {
            setCheckoutProcessing(true);
            fetch(`${apiUrl}/api/payments/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                plan_id: planId,
                billing_cycle: billingCycle,
                is_promo: isPromo
              })
            })
              .then(async verifyRes => {
                const verifyData = await verifyRes.json();
                if (!verifyRes.ok) {
                  throw new Error(verifyData.detail || "Payment verification failed.");
                }
                return verifyData;
              })
              .then(() => {
                setCheckoutSuccess(true);
                fetchSubscription(user.token);
              })
              .catch(verifyErr => {
                setCheckoutError(verifyErr.message || "Payment verification failed. Your Plus trial was not activated.");
              })
              .finally(() => {
                setCheckoutProcessing(false);
              });
          },
          prefill: {
            name: user.name,
            email: user.email
          },
          theme: {
            color: "#4f46e5"
          },
          modal: {
            ondismiss: function () {
              setCheckoutProcessing(false);
              setCheckoutError("Payment checkout cancelled by user.");
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      })
      .catch(err => {
        setCheckoutError(err.message);
        setCheckoutProcessing(false);
        if (user && err.message && !err.message.includes("cancelled by user")) {
          fetch(`${apiUrl}/api/payments/report-failure`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({
              error_message: err.message,
              is_promo: isPromo
            })
          })
            .then(() => syncNotifs())
            .catch(reportErr => console.error("Failed to report payment failure:", reportErr));
        }
      });
  };



  const renderPricingPage = () => {
    const currentPlanId = (subscription?.current_plan || 'free').toUpperCase();
    const promotionClaimed = subscription?.promotion_claimed || false;

    const displayPlans = (plans.length > 0 ? plans : [
      {
        id: "FREE",
        name: "Free",
        price_display: "₹0",
        price_numeric: 0,
        billing: "monthly",
        title: "Get started with AI Mega Assistant",
        description: "Explore AI assistance for everyday questions, learning, coding and productivity.",
        features: [
          "Core AI model",
          "Limited messages and uploads",
          "Limited image creation",
          "Basic memory",
          "Basic AI tools",
          "Standard response speed"
        ]
      },
      {
        id: "PLUS",
        name: "AI Mega Assistant Plus",
        price_display: "₹0",
        original_price_display: "₹899",
        price_numeric: 0,
        original_price_numeric: 899,
        billing: "monthly",
        promotion_duration: "1 month",
        title: "Your advanced AI assistant",
        description: "Unlock advanced intelligence for coding, research, creativity and productivity.",
        features: [
          "Advanced AI models",
          "Advanced image creation",
          "Thinking / reasoning mode",
          "Expanded memory",
          "Deep research",
          "AI coding assistance",
          "AI workflow automation",
          "Projects",
          "Custom AI assistants",
          "Higher file and image limits",
          "Priority processing"
        ],
        badge: "LIMITED TIME",
        promotion_details: "TRY PLUS FREE FOR 1 MONTH. Experience advanced AI features with our limited-time Plus offer. After the promotional period, Plus continues at ₹899/month. Cancel anytime."
      }
    ])
      .filter(p => p.id === 'FREE' || p.id === 'PLUS') as PlanConfig[];

    const plusPlan = displayPlans.find(pl => pl.id === 'PLUS');
    const promotionActive = !!(plusPlan && plusPlan.original_price_display);

    const handlePlanButtonClick = (p: PlanConfig) => {
      const activePlanLower = (subscription?.current_plan || 'free').toLowerCase();
      const cardPlanLower = p.id.toLowerCase();
      
      if (activePlanLower === cardPlanLower) {
        return;
      }
      
      if (cardPlanLower === 'plus') {
        const showPromoOnCard = promotionActive && !promotionClaimed;
        setSelectedPlanForUpgrade(p);
        setCheckoutPromoActive(showPromoOnCard);
        setSelectedPaymentMethod('card');
        setCardNumber('');
        setCardExpiry('');
        setCardCvc('');
        setCardName('');
        setSavePaymentDetails(false);
        setDemoProgress(null);
        setSimulateFailure(false);
        setCheckoutError(null);
        setCheckoutSuccess(false);
        setShowCheckoutModal(true);
      }
    };

    const handleScrollToPlus = () => {
      plusCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    return (
      <div className="flex-1 overflow-y-auto bg-slate-955 text-slate-100 h-[calc(100vh-4rem)]">
        <div className="w-full max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-8 animate-fade-in">
          {/* Header section with Close Button */}
          <div className="flex justify-between items-start border-b border-slate-900 pb-6 gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2 tracking-tight">
                <span>Choose the plan that works for you</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Get more from AI Mega Assistant with advanced AI, coding, research and productivity features.
              </p>
            </div>
            
            <button
              onClick={() => {
                setActiveTab('chat');
                window.history.pushState({}, '', '/');
              }}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 border border-slate-800"
              title="Close and return"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Promotional Banner */}
          {promotionActive && (
            <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-3xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="inline-block bg-indigo-600 text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider w-fit">
                  {plusPlan?.promotion_details?.split('.')[0] || "TRY PLUS FREE FOR 1 MONTH"}
                </span>
                <span className="text-xs font-semibold text-slate-200">
                  {plusPlan?.promotion_details?.split('.').slice(1).join('.').trim() || "Experience advanced AI features with our limited-time Plus offer."}
                </span>
              </div>
              {currentPlanId === 'PLUS' ? (
                <button
                  disabled
                  className="bg-slate-800 text-slate-500 border border-slate-750 text-xs font-extrabold px-5 py-2.5 rounded-xl transition-all cursor-not-allowed text-center whitespace-nowrap shadow-none"
                >
                  Plus Trial Active
                </button>
              ) : (
                <button
                  onClick={handleScrollToPlus}
                  className="bg-indigo-600 hover:bg-indigo-555 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl transition-all cursor-pointer text-center whitespace-nowrap active:scale-95 shadow-md shadow-indigo-600/10"
                >
                  Claim Free Offer
                </button>
              )}
            </div>
          )}

          {/* Pricing Cards Grid (Centered 2-Card Layout) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8 max-w-3xl mx-auto justify-center">
            {displayPlans.map((p) => {
              const isCurrent = p.id.toUpperCase() === currentPlanId;
              const isPlus = p.id === 'PLUS';



              let hideButton = false;
              let btnText = '';
              let isButtonDisabled = false;

              if (p.id === 'FREE') {
                if (currentPlanId === 'PLUS') {
                  hideButton = true;
                } else {
                  btnText = 'Your current plan';
                  isButtonDisabled = true;
                }
              } else {
                // This is the PLUS card
                if (currentPlanId === 'PLUS') {
                  btnText = 'Your current plan';
                  isButtonDisabled = true;
                } else {
                  isButtonDisabled = false;
                  if (promotionActive && !promotionClaimed) {
                    btnText = 'Claim Free Offer';
                  } else {
                    btnText = 'Upgrade to Plus';
                  }
                }
              }

              return (
                <div 
                  key={p.id}
                  ref={isPlus ? plusCardRef : undefined}
                  className={`relative flex flex-col p-6 rounded-3xl border transition-all justify-between min-h-[520px] ${
                    isCurrent 
                      ? 'border-indigo-600 dark:border-indigo-500 bg-slate-900 shadow-md ring-1 ring-indigo-500/10' 
                      : isPlus 
                        ? 'border-2 border-indigo-500/80 bg-gradient-to-b from-indigo-950/20 via-slate-900/80 to-slate-900/80 shadow-2xl hover:shadow-indigo-500/5'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-700/60 hover:shadow-lg'
                  }`}
                >
                  <div>
                    {isPlus && !isCurrent && promotionActive && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[9px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest whitespace-nowrap shadow-sm">
                        {p.badge || "LIMITED TIME"}
                      </div>
                    )}

                    <div className="mb-4">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{p.name}</span>
                      <h3 className="text-base font-bold text-white mt-1.5">{p.title}</h3>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed min-h-[48px]">
                        {p.description}
                      </p>
                    </div>

                    <div className="my-4">
                      {isPlus && promotionActive && !promotionClaimed && currentPlanId !== 'PLUS' ? (
                        <>
                          <div className="text-[11.5px] font-bold text-slate-400 line-through mb-0.5">{p.original_price_display} / month</div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-3xl font-black text-white">{p.price_display}</span>
                            <span className="text-xs text-slate-400 font-semibold">/ month</span>
                          </div>
                          <div className="text-xs text-emerald-400 font-bold mt-1">Try Plus free for {p.promotion_duration || "1 month"}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 font-medium">After trial: {p.original_price_display} / month</div>
                        </>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-white">{isPlus ? (p.original_price_display || p.price_display) : p.price_display}</span>
                          <span className="text-xs text-slate-400 font-semibold flex items-center">/ month</span>
                        </div>
                      )}
                    </div>
                    {isPlus && isCurrent && (
                      <div className="my-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl p-3 text-xs font-medium space-y-2">
                        <div className="font-bold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                          {subscription?.subscription_status === 'trialing' ? "Your Plus trial is active." : "Your Plus subscription is active."}
                        </div>
                        <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                          {subscription?.subscription_status === 'trialing' ? "Plus Trial Active" : "Plus Active"}
                        </div>
                        {subscription?.cancel_at_period_end ? (
                          <div className="text-[10px] text-rose-400 font-bold">
                            Cancelled — Access remains active until {subscription?.subscription_end ? new Date(subscription.subscription_end).toLocaleDateString() : 'end of billing period'}
                          </div>
                        ) : subscription?.subscription_end ? (
                          <div className="text-[10px] text-slate-400">
                            Renews on: {new Date(subscription.subscription_end).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                        ) : null}
                        <div className="pt-1 flex gap-2">
                          {subscription?.cancel_at_period_end ? (
                            <button
                              onClick={handleReactivateSubscription}
                              className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                            >
                              Reactivate Subscription
                            </button>
                          ) : (
                            <button
                              onClick={handleCancelSubscription}
                              className="w-full py-1.5 px-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                            >
                              Cancel Subscription
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {!hideButton ? (
                      <button
                        disabled={isButtonDisabled}
                        onClick={() => handlePlanButtonClick(p)}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all border text-center my-4 ${
                          isButtonDisabled 
                            ? 'bg-slate-800 text-slate-500 border-slate-750 cursor-not-allowed shadow-none'
                            : isPlus
                              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10 cursor-pointer active:scale-95 border-none font-extrabold'
                              : 'bg-slate-950 text-slate-200 border-slate-850 hover:bg-slate-850 cursor-pointer active:scale-95'
                        }`}
                      >
                        {btnText}
                      </button>
                    ) : (
                      <div className="h-[58px] my-4" />
                    )}

                    <div className="mt-2 space-y-2.5">
                      {p.features.map((feat, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-350">
                          <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Productivity Pages renderers
  const renderNotesPage = () => {
    const pinnedNotes = notes.filter(n => n.pinned);
    const unpinnedNotes = notes.filter(n => !n.pinned);
    const filteredNotes = notes.filter(n => 
      n.title.toLowerCase().includes(noteSearchQuery.toLowerCase()) || 
      n.content.toLowerCase().includes(noteSearchQuery.toLowerCase())
    );
    
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-4xl mx-auto w-full">
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-805/60">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Notes Manager</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Organize thoughts, pin items, and query via AI chat</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setEditingNote(null);
                setNoteTitleInput('');
                setNoteContentInput('');
                setNoteFormOpen(true);
              }}
              className={`px-4 py-2 text-white rounded-xl text-xs font-semibold cursor-pointer active:scale-[0.98] transition-all flex items-center gap-1.5 ${getThemeClasses(themePref).primary}`}
            >
              <PlusIcon className="w-3.5 h-3.5" /> New Note
            </button>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setActiveTab('chat'); }}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center w-8 h-8 font-bold text-xs shrink-0"
              title="Close and return"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="max-w-md">
          <input 
            type="text" 
            placeholder="Search notes content..." 
            value={noteSearchQuery} 
            onChange={e => setNoteSearchQuery(e.target.value)} 
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
          />
        </div>

        {noteFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/65 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {editingNote ? "Edit Note" : "Create New Note"}
                </h3>
                <button onClick={() => setNoteFormOpen(false)} className="text-slate-450 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <input 
                  type="text" 
                  placeholder="Note title..." 
                  value={noteTitleInput} 
                  onChange={e => setNoteTitleInput(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-805/80 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-slate-850 dark:text-slate-100 font-semibold"
                />
                <textarea 
                  placeholder="Write content..." 
                  value={noteContentInput} 
                  onChange={e => setNoteContentInput(e.target.value)} 
                  rows={6}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855/80 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-slate-850 dark:text-slate-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setNoteFormOpen(false)} className="px-4 py-2 border border-slate-250 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                  Cancel
                </button>
                <button onClick={handleSaveNote} className={`px-4 py-2 text-white rounded-xl text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer ${getThemeClasses(themePref).primary}`}>
                  Save Note
                </button>
              </div>
            </div>
          </div>
        )}

        {!notesLoading && pinnedNotes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Pinned Notes</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pinnedNotes.map(n => renderNoteCard(n))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {noteSearchQuery ? `Filtered Notes (${filteredNotes.length})` : "All Notes"}
          </h2>
          {notesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4.5 animate-pulse space-y-3">
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 text-slate-400 dark:text-slate-500 text-xs">
              No notes found. Create your first note!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {noteSearchQuery ? filteredNotes.map(n => renderNoteCard(n)) : unpinnedNotes.map(n => renderNoteCard(n))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderNoteCard = (note: Note) => {
    return (
      <div key={note.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4.5 flex flex-col justify-between shadow-sm relative group hover:border-slate-350 dark:hover:border-slate-700 transition-all">
        <div className="space-y-2">
          <div className="flex justify-between items-start gap-2">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{note.title}</h4>
            <button 
              onClick={() => handleTogglePinNote(note)}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                note.pinned 
                  ? 'text-amber-500 hover:text-amber-600 bg-amber-500/10' 
                  : 'text-slate-400 hover:text-slate-655 dark:hover:text-slate-300'
              }`}
            >
              <PinIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-350 whitespace-pre-wrap line-clamp-4">{note.content}</p>
        </div>
        
        <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100 dark:border-slate-805/60 text-[10px] text-slate-400">
          <span>{new Date(note.updated_at).toLocaleDateString()}</span>
          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => {
                setEditingNote(note);
                setNoteTitleInput(note.title);
                setNoteContentInput(note.content);
                setNoteFormOpen(true);
              }}
              className="p-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
            >
              <EditIcon className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => handleDeleteNote(note.id)}
              className="p-1 text-slate-505 hover:text-rose-500 cursor-pointer"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderTasksPage = () => {
    const incompleteTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);
    
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-4xl mx-auto w-full">
        <div className="flex justify-between items-start pb-4 border-b border-slate-200 dark:border-slate-805/60">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Task Board</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Manage project assignments, toggle priority, and let AI outline tasks</p>
          </div>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setActiveTab('chat'); }}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center w-8 h-8 font-bold text-xs shrink-0"
            title="Close and return"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 shadow-sm items-center">
          <input 
            type="text" 
            placeholder="Add a new task title..." 
            value={taskTitleInput} 
            onChange={e => setTaskTitleInput(e.target.value)} 
            onKeyDown={e => { if (e.key === 'Enter') handleCreateTask(); }}
            className="w-full sm:flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
          />
          <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
            <select 
              value={taskPriorityInput} 
              onChange={e => setTaskPriorityInput(e.target.value as any)} 
              className="bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 px-3 py-2.5 rounded-xl outline-none cursor-pointer"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
            <button 
              onClick={handleCreateTask}
              className={`px-4 py-2.5 text-white rounded-xl text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1 shrink-0 ${getThemeClasses(themePref).primary}`}
            >
              <PlusIcon className="w-3.5 h-3.5" /> Add Task
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Incomplete Tasks ({incompleteTasks.length})</h2>
          {tasksLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 animate-pulse flex items-center justify-between">
                  <div className="flex items-center gap-3 w-1/2">
                    <div className="w-4 h-4 bg-slate-200 dark:bg-slate-800 rounded-full shrink-0"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                  </div>
                  <div className="w-16 h-6 bg-slate-200 dark:bg-slate-800 rounded-lg shrink-0"></div>
                </div>
              ))}
            </div>
          ) : incompleteTasks.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 text-slate-400 dark:text-slate-500 text-xs">
              No pending tasks. Sit back or plan new targets!
            </div>
          ) : (
            <div className="space-y-2">
              {incompleteTasks.map(t => renderTaskRow(t))}
            </div>
          )}
        </div>

        {completedTasks.length > 0 && (
          <div className="space-y-3 opacity-70">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Completed Tasks ({completedTasks.length})</h2>
            <div className="space-y-2">
              {completedTasks.map(t => renderTaskRow(t))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTaskRow = (task: Task) => {
    return (
      <div key={task.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm hover:border-slate-350 dark:hover:border-slate-700/80 transition-all">
        <div className="flex items-center gap-3 min-w-0">
          <input 
            type="checkbox" 
            checked={task.completed} 
            onChange={() => handleToggleCompleteTask(task)} 
            className="w-4.5 h-4.5 text-indigo-650 border-slate-300 rounded focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-850 cursor-pointer"
          />
          <span className={`text-sm text-slate-850 dark:text-slate-100 font-semibold truncate ${task.completed ? 'line-through text-slate-450 dark:text-slate-500' : ''}`}>
            {task.title}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
            task.priority === 'high' 
              ? 'bg-rose-500/10 text-rose-550 dark:bg-rose-500/15 dark:text-rose-450' 
              : task.priority === 'medium'
              ? 'bg-amber-500/10 text-amber-605 dark:bg-amber-500/15 dark:text-amber-400'
              : 'bg-slate-500/10 text-slate-655 dark:text-slate-400'
          }`}>
            {task.priority}
          </span>
          <button 
            onClick={() => handleDeleteTask(task.id)}
            className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer transition-colors"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const renderAutomationPage = () => {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-5xl mx-auto w-full">
        {/* Header section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">AI Workflow Automation</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Automate tasks, reminders, documents, and notes using natural language workflows.
            </p>
          </div>
          
          {/* Tabs switch */}
          <div className="flex items-center gap-3 self-end md:self-auto">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setActiveAutomationSubTab('my_workflows')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeAutomationSubTab === 'my_workflows'
                    ? 'bg-white dark:bg-slate-700 text-slate-850 dark:text-white shadow-sm'
                    : 'text-slate-450 hover:text-slate-700 dark:hover:text-slate-350'
                }`}
              >
                My Workflows
              </button>
              <button
                onClick={() => setActiveAutomationSubTab('history')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeAutomationSubTab === 'history'
                    ? 'bg-white dark:bg-slate-700 text-slate-850 dark:text-white shadow-sm'
                    : 'text-slate-450 hover:text-slate-700 dark:hover:text-slate-350'
                }`}
              >
                Automation History
              </button>
            </div>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setActiveTab('chat'); }}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center w-8 h-8 font-bold text-xs shrink-0"
              title="Close and return"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {activeAutomationSubTab === 'my_workflows' ? (
          <div className="space-y-6">
            {/* Natural Language Creator card */}
            <div className="bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-200/55 dark:border-indigo-500/20 rounded-2xl p-5 shadow-sm">
              <h2 className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">AI Workflow Generator</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Describe the workflow you want to automate in plain English.
              </p>
              
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder='e.g. "Every morning create today&#39;s task list with medium priority."'
                  value={automationNLInput}
                  onChange={e => setAutomationNLInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleParseAutomationNL(); }}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                />
                <button
                  onClick={handleParseAutomationNL}
                  disabled={isParsingWorkflow}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl px-4 py-2.5 transition-all shadow-md shadow-indigo-600/10 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {isParsingWorkflow ? "Generating..." : "Automate ⚡"}
                </button>
              </div>
              
              <div className="mt-3.5 flex flex-wrap gap-2 text-[10px] text-slate-400">
                <span className="font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500 mr-1 mt-0.5">Quick Examples:</span>
                <button
                  onClick={() => setAutomationNLInput("Every morning create today's task list.")}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/10 hover:text-indigo-500 rounded-full px-2.5 py-0.5 transition-colors cursor-pointer"
                >
                  "Every morning create tasks"
                </button>
                <button
                  onClick={() => setAutomationNLInput("Save this response as a note.")}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/10 hover:text-indigo-500 rounded-full px-2.5 py-0.5 transition-colors cursor-pointer"
                >
                  "Save response as a note"
                </button>
                <button
                  onClick={() => setAutomationNLInput("Create a reminder for tomorrow at 10 AM.")}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/10 hover:text-indigo-500 rounded-full px-2.5 py-0.5 transition-colors cursor-pointer"
                >
                  "Create reminder"
                </button>
                <button
                  onClick={() => setAutomationNLInput("Summarize this document and save it.")}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/10 hover:text-indigo-500 rounded-full px-2.5 py-0.5 transition-colors cursor-pointer"
                >
                  "Summarize latest document"
                </button>
              </div>
            </div>

            {/* Manual Creator / Edit Mode card */}
            {isCreatingWorkflow ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                    {editingWorkflow ? "Edit Workflow Details" : "Create Manual Workflow"}
                  </h3>
                  <button
                    onClick={() => {
                      setIsCreatingWorkflow(false);
                      setEditingWorkflow(null);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Workflow Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Daily Sync"
                      value={wfFormName}
                      onChange={e => setWfFormName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Trigger Type</label>
                    <select
                      value={wfFormTriggerType}
                      onChange={e => setWfFormTriggerType(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 cursor-pointer"
                    >
                      <option value="schedule">Schedule</option>
                      <option value="manual">Manual Trigger</option>
                      <option value="natural_language">Chat Phrase Trigger</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Trigger condition/detail</label>
                    <input
                      type="text"
                      placeholder="e.g. Every morning at 8:00 AM"
                      value={wfFormTriggerDetail}
                      onChange={e => setWfFormTriggerDetail(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Actions Editor List */}
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Configured Actions ({wfFormActions.length})</label>
                    <button
                      onClick={() => setWfFormActions([...wfFormActions, { type: 'create_task', params: {} }])}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-bold cursor-pointer"
                    >
                      + Add Action
                    </button>
                  </div>

                  {wfFormActions.length === 0 ? (
                    <div className="text-center py-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                      No actions configured. Click "Add Action" to set up steps.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {wfFormActions.map((action, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row gap-2 items-center bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800/60 w-full">
                          <select
                            value={action.type}
                            onChange={e => {
                              const updated = [...wfFormActions];
                              updated[idx].type = e.target.value;
                              updated[idx].params = {};
                              setWfFormActions(updated);
                            }}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs outline-none text-slate-800 dark:text-slate-100 w-full sm:w-1/4 cursor-pointer"
                          >
                            <option value="create_task">Create Task</option>
                            <option value="create_note">Create Note</option>
                            <option value="create_reminder">Create Reminder</option>
                            <option value="summarize_document">Summarize Document</option>
                            <option value="save_response">Save Response</option>
                          </select>

                          <div className="flex-1 flex gap-2 w-full">
                            {action.type === 'create_task' && (
                              <>
                                <input
                                  type="text"
                                  placeholder="Task Title..."
                                  value={action.params.title || ''}
                                  onChange={e => {
                                    const updated = [...wfFormActions];
                                    updated[idx].params.title = e.target.value;
                                    setWfFormActions(updated);
                                  }}
                                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs outline-none text-slate-800 dark:text-slate-100"
                                />
                                <select
                                  value={action.params.priority || 'medium'}
                                  onChange={e => {
                                    const updated = [...wfFormActions];
                                    updated[idx].params.priority = e.target.value;
                                    setWfFormActions(updated);
                                  }}
                                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs outline-none text-slate-800 dark:text-slate-100 cursor-pointer"
                                >
                                  <option value="low">Low</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                </select>
                              </>
                            )}

                            {action.type === 'create_note' && (
                              <>
                                <input
                                  type="text"
                                  placeholder="Note Title..."
                                  value={action.params.title || ''}
                                  onChange={e => {
                                    const updated = [...wfFormActions];
                                    updated[idx].params.title = e.target.value;
                                    setWfFormActions(updated);
                                  }}
                                  className="w-1/3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs outline-none text-slate-800 dark:text-slate-100"
                                />
                                <input
                                  type="text"
                                  placeholder="Note Content..."
                                  value={action.params.content || ''}
                                  onChange={e => {
                                    const updated = [...wfFormActions];
                                    updated[idx].params.content = e.target.value;
                                    setWfFormActions(updated);
                                  }}
                                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs outline-none text-slate-800 dark:text-slate-100"
                                />
                              </>
                            )}

                            {action.type === 'create_reminder' && (
                              <>
                                <input
                                  type="text"
                                  placeholder="Reminder details..."
                                  value={action.params.title || ''}
                                  onChange={e => {
                                    const updated = [...wfFormActions];
                                    updated[idx].params.title = e.target.value;
                                    setWfFormActions(updated);
                                  }}
                                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs outline-none text-slate-800 dark:text-slate-100"
                                />
                                <input
                                  type="text"
                                  placeholder="tomorrow at 10 AM"
                                  value={action.params.datetime || ''}
                                  onChange={e => {
                                    const updated = [...wfFormActions];
                                    updated[idx].params.datetime = e.target.value;
                                    setWfFormActions(updated);
                                  }}
                                  className="w-1/3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs outline-none text-slate-800 dark:text-slate-100"
                                />
                              </>
                            )}

                            {action.type === 'summarize_document' && (
                              <select
                                value={action.params.document_id || 'latest'}
                                onChange={e => {
                                  const updated = [...wfFormActions];
                                  updated[idx].params.document_id = e.target.value;
                                  setWfFormActions(updated);
                                }}
                                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs outline-none text-slate-800 dark:text-slate-100 cursor-pointer"
                              >
                                <option value="latest">Latest Modified Document</option>
                                {documents.map(d => (
                                  <option key={d.id} value={d.id}>{d.title}</option>
                                ))}
                              </select>
                            )}

                            {action.type === 'save_response' && (
                              <input
                                type="text"
                                placeholder="Static text (leave empty to save last bot chat response)"
                                value={action.params.content || ''}
                                onChange={e => {
                                  const updated = [...wfFormActions];
                                  updated[idx].params.content = e.target.value;
                                  setWfFormActions(updated);
                                }}
                                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs outline-none text-slate-800 dark:text-slate-100"
                              />
                            )}
                          </div>

                          <button
                            onClick={() => setWfFormActions(wfFormActions.filter((_, i) => i !== idx))}
                            className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded cursor-pointer shrink-0"
                            title="Remove Step"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-150 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setIsCreatingWorkflow(false);
                      setEditingWorkflow(null);
                    }}
                    className="border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 px-3.5 py-2 text-xs font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateOrUpdateWorkflow}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl px-4 py-2.5 transition-all cursor-pointer"
                  >
                    {editingWorkflow ? "Save Changes" : "Create Workflow"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setIsCreatingWorkflow(true);
                    setEditingWorkflow(null);
                    setWfFormName('');
                    setWfFormTriggerType('schedule');
                    setWfFormTriggerDetail('Every day at 9:00 AM');
                    setWfFormActions([{ type: 'create_task', params: { title: 'Review daily checklist', priority: 'medium' } }]);
                  }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-55 text-slate-750 dark:text-slate-200 text-xs font-bold rounded-xl px-3.5 py-2 cursor-pointer transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Manually Create Workflow
                </button>
              </div>
            )}

            {/* Workflows Cards List */}
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Active Workflows ({workflows.length})</h3>
              
              {workflowsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm animate-pulse flex flex-col justify-between space-y-4">
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-2 w-2/3">
                          <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
                          <div className="flex gap-1.5 mt-1">
                            <div className="w-12 h-4 bg-slate-200 dark:bg-slate-800 rounded"></div>
                            <div className="w-20 h-4 bg-slate-200 dark:bg-slate-800 rounded"></div>
                          </div>
                        </div>
                        <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 rounded-full shrink-0"></div>
                      </div>
                      <div className="h-10 bg-slate-50 dark:bg-slate-950/40 rounded-xl"></div>
                    </div>
                  ))}
                </div>
              ) : workflows.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-8 text-center text-slate-400 text-xs">
                  No automated workflows defined. Type a prompt above or click "Manually Create Workflow" to get started!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {workflows.map(flow => (
                    <div key={flow.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-4">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 animate-fade-in">
                          <h4 className="text-xs font-bold text-slate-850 dark:text-slate-100 truncate">{flow.name}</h4>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-md px-1.5 py-0.5 capitalize">
                              {flow.trigger_type}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[150px]">{flow.trigger_detail}</span>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleToggleWorkflow(flow)}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                            flow.enabled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'
                          }`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                            flow.enabled ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>

                      <div className="space-y-1 bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-100/60 dark:border-slate-800/50">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Steps to Execute ({flow.actions.length})</span>
                        <div className="space-y-0.5">
                          {flow.actions.map((act, i) => (
                            <div key={i} className="text-[10px] text-slate-600 dark:text-slate-350 flex gap-1.5 items-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                              <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                                {act.type.replace('_', ' ')}:
                              </span>
                              <span className="truncate">{act.params.title || act.params.content || act.params.document_id || 'default parameters'}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-850 pt-3">
                        <button
                          onClick={() => handleDeleteWorkflow(flow.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer rounded hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                          title="Delete Workflow"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setIsCreatingWorkflow(true);
                              setEditingWorkflow(flow);
                              setWfFormName(flow.name);
                              setWfFormTriggerType(flow.trigger_type);
                              setWfFormTriggerDetail(flow.trigger_detail);
                              setWfFormActions(flow.actions);
                            }}
                            className="border border-slate-200 dark:border-slate-750 text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-bold rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleExecuteWorkflow(flow.id)}
                            disabled={isExecutingWorkflowId === flow.id}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-lg px-3 py-1.5 transition-all shadow-md shadow-indigo-500/10 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                          >
                            {isExecutingWorkflowId === flow.id ? (
                              "Running..."
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                                </svg>
                                Run Now
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Workflow execution history ({workflowHistory.length})</h3>
            {workflowHistory.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-8 text-center text-slate-400 text-xs">
                No executions recorded yet. Run a workflow or use natural language triggers to see history!
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden shadow-sm">
                {workflowHistory.map(entry => (
                  <div key={entry.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{entry.workflow_name}</span>
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-bold px-1.5 py-0.5 rounded capitalize">
                          Trigger: {entry.trigger}
                        </span>
                        <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Success
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{entry.details}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(entry.executed_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleMarkAllNotificationsRead = () => {
    if (!user) return;
    const unreads = notificationsList.filter(n => n.status === 'unread');
    if (unreads.length === 0) return;
    setNotificationsList(prev => prev.map(n => ({ ...n, status: 'read' })));
    setUnreadNotificationCount(0);
    fetch(`${apiUrl}/api/notifications/read-all`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${user.token}` }
    }).catch(err => console.error(err));
  };

  const handleClearAllNotifications = () => {
    if (!user) return;
    if (notificationsList.length === 0) return;
    const listToClear = [...notificationsList];
    setNotificationsList([]);
    setUnreadNotificationCount(0);
    listToClear.forEach(n => {
      fetch(`${apiUrl}/api/notifications/${n.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token}` }
      }).catch(err => console.error(err));
    });
  };

  const renderNotificationsPage = () => {
    // Filter notifications based on search query and active tab filter
    const filteredNotifications = notificationsList.filter(n => {
      // 1. Search filter
      const searchMatch = !notifSearchQuery.trim() || 
        n.title.toLowerCase().includes(notifSearchQuery.toLowerCase()) || 
        n.message.toLowerCase().includes(notifSearchQuery.toLowerCase());
        
      if (!searchMatch) return false;
      
      // 2. Tab Filter
      if (notifFilter === 'unread') return n.status === 'unread';
      if (notifFilter === 'system') return ['system', 'reminder', 'task', 'account_security', 'plan_billing', 'assistant_updates'].includes(n.type?.toLowerCase());
      if (notifFilter === 'ai') return ['automation', 'ai', 'image_gen', 'background_ai'].includes(n.type?.toLowerCase());
      
      return true; // 'all'
    });

    const unreadFiltered = filteredNotifications.filter(n => n.status === 'unread');
    const readFiltered = filteredNotifications.filter(n => n.status === 'read');

    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-4xl mx-auto w-full">
        {/* Header section with Close Button */}
        <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800/80 pb-4 gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>🔔 Notifications Hub</span>
            </h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Review and manage alerts from AI Automation, Tasks, Reminders, and Workflow runs.
            </p>
          </div>
          
          <button
            onClick={() => setActiveTab(previousTab || 'chat')}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
            title="Close and return"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Toolbar: Search, Filters & Bulk Actions */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-slate-50/50 dark:bg-slate-900/30 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
          {/* Left: Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={notifSearchQuery}
                onChange={(e) => setNotifSearchQuery(e.target.value)}
                placeholder="Search notifications..."
                className="w-full pl-8 pr-3.5 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
              />
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
              </svg>
            </div>

            {/* Filter Tabs */}
            <div className="flex bg-white dark:bg-slate-955 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800/80 self-start sm:self-auto">
              {(['all', 'unread', 'system', 'ai'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setNotifFilter(f)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                    notifFilter === f 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-slate-650 dark:hover:text-slate-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex gap-2 shrink-0 justify-end">
            {unreadFiltered.length > 0 && (
              <button
                onClick={handleMarkAllNotificationsRead}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-55 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-[10px] font-bold uppercase tracking-wider rounded-xl px-3 py-2 cursor-pointer transition-all shadow-sm flex items-center gap-1.5"
              >
                ✓ Mark all read
              </button>
            )}
            
            {filteredNotifications.length > 0 && (
              <button
                onClick={handleClearAllNotifications}
                className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-bold uppercase tracking-wider rounded-xl px-3 py-2 cursor-pointer transition-all shadow-sm flex items-center gap-1.5"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-12 text-center text-slate-400 text-xs shadow-sm">
            <span className="text-3xl block mb-2">🔔</span>
            No notifications match your search and filter criteria.
          </div>
        ) : (
          <div className="space-y-6">
            {/* New / Unread alerts section */}
            {unreadFiltered.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-[10px] font-extrabold text-rose-500 dark:text-rose-455 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  New Alerts ({unreadFiltered.length})
                </h3>
                
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden shadow-sm">
                  {unreadFiltered.map(notif => {
                    const isImportant = notif.priority === 'important';
                    const categoryEmoji = 
                      notif.type === 'task' ? '📋' :
                      notif.type === 'automation' ? '⚡' :
                      notif.type === 'reminder' ? '⏰' :
                      notif.type === 'documents_files' ? '📄' :
                      notif.type === 'image_gen' ? '🎨' :
                      notif.type === 'background_ai' ? '🧠' :
                      notif.type === 'account_security' ? '🛡️' :
                      notif.type === 'plan_billing' ? '💳' :
                      notif.type === 'assistant_updates' ? '📢' : '🔔';
                      
                    return (
                      <div 
                        key={notif.id} 
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-4 flex justify-between items-start gap-4 transition-colors cursor-pointer border-l-4 ${
                          isImportant 
                            ? 'border-l-rose-500 bg-rose-500/[0.02] hover:bg-rose-500/[0.04]' 
                            : 'border-l-indigo-500 bg-indigo-500/[0.01] hover:bg-indigo-500/[0.03]'
                        }`}
                      >
                        <div className="flex gap-3 items-start min-w-0">
                          <span className="text-lg bg-slate-50 dark:bg-slate-950 p-1.5 rounded-lg shrink-0">
                            {categoryEmoji}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center flex-wrap gap-1.5">
                              <span className="text-xs font-bold text-slate-850 dark:text-slate-100">{notif.title}</span>
                              <span className="bg-rose-500/10 text-rose-600 dark:text-rose-455 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">new</span>
                              {isImportant && (
                                <span className="bg-rose-600 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">important</span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-350 mt-1">{notif.message}</p>
                            <span className="text-[9px] text-slate-400 dark:text-slate-555 block mt-1.5">
                              {new Date(notif.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleMarkNotificationRead(notif.id)}
                            className="text-[10px] bg-slate-100 hover:bg-indigo-650 hover:text-white dark:bg-slate-800 text-slate-750 dark:text-slate-200 font-bold px-2 py-1 rounded transition-colors cursor-pointer"
                            title="Mark Read"
                          >
                            Read
                          </button>
                          <button
                            onClick={() => handleDeleteNotification(notif.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer rounded hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                            title="Delete Alert"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cleared / Read alerts section */}
            {readFiltered.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Cleared Alerts ({readFiltered.length})
                </h3>
                
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden shadow-sm">
                  {readFiltered.map(notif => {
                    const isImportant = notif.priority === 'important';
                    const categoryEmoji = 
                      notif.type === 'task' ? '📋' :
                      notif.type === 'automation' ? '⚡' :
                      notif.type === 'reminder' ? '⏰' :
                      notif.type === 'documents_files' ? '📄' :
                      notif.type === 'image_gen' ? '🎨' :
                      notif.type === 'background_ai' ? '🧠' :
                      notif.type === 'account_security' ? '🛡️' :
                      notif.type === 'plan_billing' ? '💳' :
                      notif.type === 'assistant_updates' ? '📢' : '🔔';

                    return (
                      <div 
                        key={notif.id} 
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-4 flex justify-between items-start gap-4 transition-colors cursor-pointer border-l-4 opacity-75 ${
                          isImportant 
                            ? 'border-l-rose-500/50 bg-rose-500/[0.005] hover:bg-rose-500/[0.02]' 
                            : 'border-l-slate-200 dark:border-l-slate-800 hover:bg-slate-55/50 dark:hover:bg-slate-800/10'
                        }`}
                      >
                        <div className="flex gap-3 items-start min-w-0">
                          <span className="text-lg bg-slate-50 dark:bg-slate-955 p-1.5 rounded-lg shrink-0 grayscale">
                            {categoryEmoji}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center flex-wrap gap-1.5">
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{notif.title}</span>
                              {isImportant && (
                                <span className="bg-rose-600/50 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">important</span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-505 dark:text-slate-400 mt-1">{notif.message}</p>
                            <span className="text-[9px] text-slate-400 dark:text-slate-555 block mt-1.5">
                              {new Date(notif.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteNotification(notif.id); }}
                          className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer rounded hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors shrink-0"
                          title="Delete Alert"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderRemindersPage = () => {
    const incompleteReminders = reminders.filter(r => r.status === 'upcoming');
    const completedReminders = reminders.filter(r => r.status === 'completed');
    const missedReminders = reminders.filter(r => r.status === 'missed');
    
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-4xl mx-auto w-full">
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-805/60">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Smart Reminders</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Schedule smart time alerts with priorities and recurring frequencies.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {editingReminder && (
              <button
                onClick={() => {
                  setEditingReminder(null);
                  setReminderTitleInput('');
                  setReminderDescriptionInput('');
                  setReminderDateTimeInput('');
                  setReminderRepeatTypeInput('once');
                  setReminderPriorityInput('medium');
                }}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Clear Edit
              </button>
            )}
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setActiveTab('chat'); }}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center w-8 h-8 font-bold text-xs shrink-0"
              title="Close and return"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>


        {/* Dynamic Scheduler Form */}
        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="text-xs font-extrabold text-slate-450 dark:text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">
            {editingReminder ? '📝 Edit Scheduled Reminder' : '⏰ Schedule New Reminder'}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reminder Title</label>
                <input 
                  type="text" 
                  placeholder="What should we remind you of?" 
                  value={reminderTitleInput} 
                  onChange={e => setReminderTitleInput(e.target.value)} 
                  className="w-full bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-slate-805 dark:text-slate-100 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description (Optional)</label>
                <input 
                  type="text" 
                  placeholder="Add details, links, or notes..." 
                  value={reminderDescriptionInput} 
                  onChange={e => setReminderDescriptionInput(e.target.value)} 
                  className="w-full bg-slate-55 dark:bg-slate-955 border border-slate-200 dark:border-slate-805 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-slate-805 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="space-y-3 col-span-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due Date & Time</label>
                  <input 
                    type="datetime-local" 
                    value={reminderDateTimeInput} 
                    onChange={e => setReminderDateTimeInput(e.target.value)} 
                    className="w-full bg-slate-55 dark:bg-slate-955 border border-slate-200 dark:border-slate-805 text-xs font-semibold text-slate-750 dark:text-slate-305 px-3 py-2 rounded-xl outline-none cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Repeat Frequency</label>
                  <select 
                    value={reminderRepeatTypeInput} 
                    onChange={e => setReminderRepeatTypeInput(e.target.value as any)} 
                    className="w-full bg-slate-55 dark:bg-slate-955 border border-slate-200 dark:border-slate-805 text-xs font-semibold text-slate-755 dark:text-slate-305 px-3 py-2 rounded-xl outline-none cursor-pointer"
                  >
                    <option value="once">Once</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Priority Alert</label>
                  <select 
                    value={reminderPriorityInput} 
                    onChange={e => setReminderPriorityInput(e.target.value as any)} 
                    className="w-full bg-slate-55 dark:bg-slate-955 border border-slate-200 dark:border-slate-805 text-xs font-semibold text-slate-755 dark:text-slate-305 px-3 py-2 rounded-xl outline-none cursor-pointer"
                  >
                    <option value="low">Low Alert</option>
                    <option value="medium">Medium Alert</option>
                    <option value="high">High Alert</option>
                  </select>
                </div>

                <button 
                  onClick={handleCreateReminder}
                  className={`w-full py-2.5 text-white rounded-xl text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${getThemeClasses(themePref).primary}`}
                >
                  {editingReminder ? (
                    <>💾 Save Changes</>
                  ) : (
                    <><PlusIcon className="w-3.5 h-3.5" /> Schedule Reminder</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Reminders layout lists */}
        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-3">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-indigo-655 dark:text-indigo-400">Upcoming Alerts ({incompleteReminders.length})</h2>
            {remindersLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 animate-pulse flex flex-col justify-between space-y-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex gap-2.5 items-start w-2/3">
                        <div className="w-4.5 h-4.5 bg-slate-200 dark:bg-slate-800 rounded mt-0.5 shrink-0"></div>
                        <div className="space-y-2 w-full">
                          <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
                          <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
                        </div>
                      </div>
                      <div className="w-10 h-4 bg-slate-200 dark:bg-slate-800 rounded shrink-0"></div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="w-24 h-3 bg-slate-200 dark:bg-slate-800 rounded"></div>
                      <div className="w-16 h-3 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : incompleteReminders.length === 0 ? (
              <div className="text-center py-6 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/40 text-slate-400 dark:text-slate-500 text-xs shadow-sm rounded-2xl">
                No active upcoming reminders scheduled.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {incompleteReminders.map(r => renderReminderRow(r))}
              </div>
            )}
          </div>

          {missedReminders.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-rose-500 dark:text-rose-400">Missed / Expired Alerts ({missedReminders.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {missedReminders.map(r => renderReminderRow(r))}
              </div>
            </div>
          )}

          {completedReminders.length > 0 && (
            <div className="space-y-3 opacity-70">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-emerald-555 dark:text-emerald-400">Completed Alerts ({completedReminders.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {completedReminders.map(r => renderReminderRow(r))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderReminderRow = (reminder: Reminder) => {
    const eventTime = new Date(reminder.datetime);
    const repText = reminder.repeat_type || 'once';
    const pri = reminder.priority || 'medium';
    const statusVal = reminder.status || 'upcoming';

    return (
      <div key={reminder.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-350 dark:hover:border-slate-700/80 transition-all space-y-4">
        <div className="flex justify-between items-start gap-2">
          <div className="flex gap-2.5 items-start min-w-0">
            <input 
              type="checkbox" 
              checked={reminder.completed || statusVal === 'completed'} 
              onChange={() => handleToggleCompleteReminder(reminder)} 
              className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-850 cursor-pointer mt-0.5"
            />
            <div className="min-w-0">
              <h4 className={`text-xs font-extrabold text-slate-855 dark:text-slate-100 ${reminder.completed || statusVal === 'completed' ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                {reminder.title}
              </h4>
              {reminder.description && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {reminder.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1 items-end shrink-0">
            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider ${
              pri === 'high' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' :
              pri === 'medium' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
              'bg-slate-500/10 text-slate-655 dark:text-slate-400'
            }`}>
              {pri}
            </span>
            <span className="text-[8px] bg-slate-55 dark:bg-slate-955 text-slate-405 font-medium px-1 rounded flex items-center gap-0.5 mt-0.5 capitalize">
              🔄 {repText}
            </span>
          </div>
        </div>

        <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-850/80 pt-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Scheduled Alert</span>
            <span className="text-[10px] font-bold text-slate-805 dark:text-slate-200">
              {eventTime.toLocaleDateString()} {eventTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${
              statusVal === 'completed' ? 'bg-emerald-500 text-white' :
              statusVal === 'missed' ? 'bg-rose-500 text-white animate-pulse' :
              'bg-indigo-500 text-white'
            }`}>
              {statusVal}
            </span>

            {statusVal === 'upcoming' && (
              <div className="flex gap-0.5">
                <button
                  onClick={() => handleSnoozeReminder(reminder, 5)}
                  className="text-[9px] bg-slate-100 hover:bg-indigo-600 hover:text-white dark:bg-slate-800 text-slate-700 dark:text-slate-350 px-1 py-0.5 rounded transition-all cursor-pointer font-bold"
                  title="Snooze 5 mins"
                >
                  +5m
                </button>
                <button
                  onClick={() => handleSnoozeReminder(reminder, 15)}
                  className="text-[9px] bg-slate-100 hover:bg-indigo-650 hover:text-white dark:bg-slate-800 text-slate-700 dark:text-slate-350 px-1 py-0.5 rounded transition-all cursor-pointer font-bold"
                  title="Snooze 15 mins"
                >
                  +15m
                </button>
              </div>
            )}

            <button
              onClick={() => handleEditClick(reminder)}
              className="p-1 text-slate-400 hover:text-indigo-650 cursor-pointer rounded hover:bg-slate-105 dark:hover:bg-slate-800 transition-colors"
              title="Edit Reminder"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.83 20.082a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
            </button>

            <button 
              onClick={() => handleDeleteReminder(reminder.id)}
              className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer rounded hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
              title="Delete Reminder"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (accessDenied) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center">
        <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center text-4xl mb-6 shadow-sm animate-bounce">
          🛡️
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">403 Forbidden</h1>
        <p className="text-sm text-slate-500 dark:text-slate-450 max-w-md mb-6 leading-relaxed">
          Access Denied. You do not have the required administrative permissions to view this resource.
        </p>
        <button
          onClick={() => {
            setAccessDenied(false);
            if (window.location.hash) window.location.hash = '';
            if (window.location.pathname === '/admin') window.history.replaceState({}, '', '/');
            setActiveTab('chat');
          }}
          className={`px-6 py-3 text-white rounded-xl text-xs font-bold active:scale-[0.98] transition-all cursor-pointer shadow-md ${getThemeClasses(themePref).primary}`}
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen h-[100dvh] w-screen flex overflow-hidden bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      {/* Mobile Sidebar Overlay Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Panel (Responsive) */}
      <aside
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-50 bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex flex-col transform transition-all duration-300 ease-in-out md:transition-none md:static ${
          sidebarOpen
            ? 'w-64 translate-x-0 border-r opacity-100'
            : 'w-0 -translate-x-full md:translate-x-0 md:opacity-0 md:pointer-events-none md:border-r-0 overflow-hidden'
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-16 border-b border-slate-200 dark:border-slate-800/80 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-lg flex items-center justify-center text-white shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <span className="font-extrabold text-sm tracking-wider uppercase bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
              Mega Assistant
            </span>
          </div>
          {/* Close Sidebar Mobile Trigger */}
          <button
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            onClick={() => setSidebarOpen(false)}
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Content: Actions & List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* New Chat Button */}
          <button
            onClick={handleNewChat}
            className={`w-full flex items-center justify-center gap-2 text-white rounded-xl py-3 px-4 text-sm font-semibold active:scale-[0.98] transition-all cursor-pointer ${getThemeClasses(themePref).primary}`}
          >
            <PlusIcon className="w-4 h-4" />
            New Chat
          </button>
          
          {/* Productivity Navigation Tabs */}
          <div className="space-y-1 bg-white/40 dark:bg-slate-950/20 p-2 rounded-2xl border border-slate-200/50 dark:border-slate-800/40">
            <button
              type="button"
              onClick={toggleProductivity}
              aria-expanded={productivityExpanded}
              aria-label={productivityExpanded ? "Collapse Productivity" : "Expand Productivity"}
              className="w-full flex items-center justify-between text-[9px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest px-1.5 mb-1.5 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              <span>Productivity</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className={`w-3 h-3 transition-transform duration-200 ${productivityExpanded ? 'rotate-0' : '-rotate-90'}`}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {productivityExpanded && (
              <div className="space-y-0.5 transition-all duration-200">
                <button
                  onClick={() => navigateToRoute('/')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'chat'
                      ? 'bg-indigo-650/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-655 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-805/50'
                  }`}
                >
                  <BrainIcon className="w-3.5 h-3.5" />
                  Chat Assistant
                </button>
                <button
                  onClick={() => navigateToRoute('/notes')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'notes'
                      ? 'bg-indigo-650/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-655 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-805/50'
                  }`}
                >
                  <EditIcon className="w-3.5 h-3.5" />
                  Notes
                </button>
                <button
                  onClick={() => navigateToRoute('/tasks')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'tasks'
                      ? 'bg-indigo-650/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-655 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-805/50'
                  }`}
                >
                  <PinIcon className="w-3.5 h-3.5" />
                  Tasks
                </button>
                <button
                  onClick={() => navigateToRoute('/reminders')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'reminders'
                      ? 'bg-indigo-650/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-655 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-805/50'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  Reminders
                </button>
                <button
                  onClick={() => {
                    navigateToRoute('/documents');
                    setActiveDocument(null);
                    setIsEditingDoc(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'documents'
                      ? 'bg-indigo-650/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-655 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-805/50'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  Documents
                </button>
                <button
                  onClick={() => {
                    navigateToRoute('/automation');
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'automation'
                      ? 'bg-indigo-650/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-655 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-850/50'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                  </svg>
                  AI Automation
                </button>
              </div>
            )}
          </div>

          {/* Search bar */}
          <div className="px-1 pt-1">
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 border border-slate-205 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Pinned Chat Sessions list */}
          {sortedPinned.length > 0 && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={togglePinned}
                aria-expanded={pinnedExpanded}
                aria-label={pinnedExpanded ? "Collapse Pinned" : "Expand Pinned"}
                className="w-full flex items-center justify-between text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest px-2 mb-2 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                <span>Pinned</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  className={`w-3 h-3 transition-transform duration-200 ${pinnedExpanded ? 'rotate-0' : '-rotate-90'}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {pinnedExpanded && (
                <div className="space-y-1 transition-all duration-200">
                  {sortedPinned.map((session) => renderSessionItem(session))}
                </div>
              )}
            </div>
          )}

          {/* All/Recent Chat Sessions list */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={toggleRecentChats}
              aria-expanded={recentChatsExpanded}
              aria-label={recentChatsExpanded ? "Collapse Recent Chats" : "Expand Recent Chats"}
              className="w-full flex items-center justify-between text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest px-2 mb-2 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              <span>Recent Chats</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className={`w-3 h-3 transition-transform duration-200 ${recentChatsExpanded ? 'rotate-0' : '-rotate-90'}`}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {recentChatsExpanded && (
              <div className="space-y-1 transition-all duration-200">
                {sortedOthers.length === 0 && sortedPinned.length === 0 ? (
                  <span className="block text-xs text-center text-slate-400 dark:text-slate-500 py-4">No chats found</span>
                ) : (
                  sortedOthers.map((session) => renderSessionItem(session))
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Chat Interface */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Chat Pane Header */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800/60 px-4 flex items-center justify-between shrink-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md z-30">
          {/* Left section: Hamburger (☰) + Logo & dropdown arrow */}
          <div className="flex items-center gap-4 relative">
            {/* Hamburger menu trigger */}
            <button
              ref={sidebarTriggerRef}
              onClick={() => {
                const next = !sidebarOpen;
                setSidebarOpen(next);
                localStorage.setItem('mega_sidebar_open', JSON.stringify(next));
              }}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer transition-all hover:scale-105"
              title="Toggle sidebar"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
            
            {/* Clickable logo + name */}
            <div className="flex items-center gap-2">
              <div 
                onClick={() => {
                  setActiveTab('chat');
                  window.history.pushState({}, '', '/');
                }}
                className="flex items-center gap-2 cursor-pointer select-none active:opacity-80 transition-all"
              >
                <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-500/10">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </div>
                <span className="font-extrabold text-sm tracking-wider uppercase bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                  Mega Assistant
                </span>
              </div>
            </div>
          </div>

          {/* Right section: Dynamic Plan Badge & Profile Avatar */}
          <div className="flex items-center gap-3 relative">
            <button
              onClick={() => {
                setActiveTab('pricing');
                window.history.pushState({}, '', '/pricing');
              }}
              className="bg-violet-500/10 text-violet-650 dark:text-violet-400 border border-violet-500/20 text-xs font-bold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm shadow-violet-500/5 select-none hover:bg-violet-500/20 transition-all cursor-pointer"
            >
              <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse"></span>
              {user?.account_type === 'PRO' ? 'Mega Pro' : user?.account_type === 'PLUS' ? 'Mega Plus' : 'Mega Free'}
            </button>

            {/* Profile Avatar Trigger */}
            {user && (
              <div className="relative">
                <button 
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-900 p-1.5 rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-800/80 shadow-sm"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover shadow-sm"
                    />
                  ) : (
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${getThemeClasses(themePref).avatarBg} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                      {getInitials(user.name)}
                    </div>
                  )}
                  <span className="hidden sm:block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {user.name}
                  </span>
                </button>

                {/* Profile menu dropdown box */}
                {profileMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                    <div ref={profileMenuRef} className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-3 z-50 transition-all animate-in fade-in-50 duration-150 space-y-2">
                      <button
                        onClick={() => {
                          setEditProfileName(user.name);
                          setEditProfileAvatar(user.avatar || '');
                          setEditProfileUsername(user.username || "@" + user.name.toLowerCase().replace(" ", ""));
                          setEditProfileBio(user.bio || '');
                          setEditProfilePhone(user.phone || '');
                          setEditProfileCountry(user.country || '');
                          setEditProfileLanguage(user.language || 'English');
                          setEditProfileTimezone(user.timezone || 'UTC');
                          setIsEditingProfile(false);
                          navigateToRoute('/profile');
                          setProfileMenuOpen(false);
                        }}
                        className="w-full text-left p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-2xl transition-all cursor-pointer border border-slate-100 dark:border-slate-800 flex items-center gap-3"
                        title="View Profile Overview"
                      >
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover shadow-sm shrink-0"
                          />
                        ) : (
                          <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${getThemeClasses(themePref).avatarBg} flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0`}>
                            {getInitials(user.name)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                            {user.name}
                          </span>
                          <span className="block text-[10px] font-semibold text-slate-400 dark:text-slate-550 truncate mt-0.5">
                            {user.username || "@" + user.name.toLowerCase().replace(" ", "")}
                          </span>
                          <span className="block text-[10px] text-slate-450 dark:text-slate-500 truncate">
                            {user.email}
                          </span>
                        </div>
                      </button>

                      <div className="border-b border-slate-100 dark:border-slate-800/80" />

                      <div className="space-y-1">
                        <span className="block text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
                          Available Accounts
                        </span>
                        
                        {accounts.filter(a => a.id !== user.id).map(acc => (
                          <div 
                            key={acc.id}
                            className="w-full flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl p-2 border border-dashed border-slate-200 dark:border-slate-800/85 group cursor-pointer transition-all"
                            onClick={() => handleSwitchAccount(acc)}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {acc.avatar ? (
                                <img src={acc.avatar} className="w-7 h-7 rounded-full object-cover shrink-0" alt="" />
                              ) : (
                                <div className={`w-7 h-7 rounded-full bg-gradient-to-tr ${getThemeClasses(themePref).avatarBg} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                                  {getInitials(acc.name)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                                  {acc.name}
                                </span>
                                <span className="block text-[9px] text-slate-400 truncate leading-none mt-0.5">
                                  {acc.email}
                                </span>
                              </div>
                            </div>
                            
                            <button
                              type="button"
                              onClick={(e) => handleRemoveAccount(acc.id, e)}
                              title="Sign out of this account"
                              className="p-1 rounded-lg text-slate-450 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                              <CloseIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        <button
                          onClick={() => {
                            navigateToRoute('/accounts/add');
                            setProfileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl px-2.5 py-2 text-xs text-indigo-600 dark:text-indigo-400 font-bold transition-all cursor-pointer text-left border border-dashed border-slate-200 dark:border-slate-800"
                        >
                          <span>➕</span> Add Another Account
                        </button>
                      </div>

                      <div className="border-b border-slate-100 dark:border-slate-800/80" />

                      <div className="space-y-0.5">
                        <button
                          onClick={() => {
                            setEditProfileName(user.name);
                            setEditProfileAvatar(user.avatar || '');
                            setEditProfileUsername(user.username || "@" + user.name.toLowerCase().replace(" ", ""));
                            setEditProfileBio(user.bio || '');
                            setEditProfilePhone(user.phone || '');
                            setEditProfileCountry(user.country || '');
                            setEditProfileLanguage(user.language || 'English');
                            setEditProfileTimezone(user.timezone || 'UTC');
                            setIsEditingProfile(false);
                            navigateToRoute('/profile');
                            setProfileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl px-2.5 py-2 text-xs text-slate-655 dark:text-slate-300 transition-colors cursor-pointer text-left font-medium"
                        >
                          <ProfileIcon className="w-3.5 h-3.5 text-slate-455" />
                          My Profile
                        </button>

                        <button
                          onClick={() => {
                            navigateToRoute('/settings');
                            setProfileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl px-2.5 py-2 text-xs text-slate-655 dark:text-slate-300 transition-colors cursor-pointer text-left font-medium"
                        >
                          <SettingsIcon className="w-3.5 h-3.5 text-slate-455" />
                          Settings
                        </button>

                        <button
                          onClick={() => {
                            navigateToRoute('/notifications');
                            setProfileMenuOpen(false);
                          }}
                          className="w-full flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl px-2.5 py-2 text-xs text-slate-655 dark:text-slate-300 transition-colors cursor-pointer text-left font-medium"
                        >
                          <div className="flex items-center gap-2.5">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-slate-455">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                            </svg>
                            Notifications
                          </div>
                          {unreadNotificationCount > 0 && (
                            <span className="bg-rose-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 animate-pulse">
                              {unreadNotificationCount}
                            </span>
                          )}
                        </button>



                        <button
                          onClick={() => {
                            navigateToRoute('/pricing');
                            setProfileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl px-2.5 py-2 text-xs text-slate-655 dark:text-slate-300 transition-colors cursor-pointer text-left font-medium"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-slate-455">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.752-3.755L12 11.25l2.248.177.752 3.755M2.25 12a9.75 9.75 0 1 1 19.5 0 9.75 9.75 0 0 1-19.5 0Z" />
                          </svg>
                          Subscription
                        </button>

                        <button
                          onClick={() => {
                            navigateToRoute('/help');
                            setProfileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl px-2.5 py-2 text-xs text-slate-655 dark:text-slate-300 transition-colors cursor-pointer text-left font-medium"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-slate-455">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                          </svg>
                          Help
                        </button>
                        
                        {user.role === 'admin' && (
                          <button
                            onClick={() => {
                              const targetUrl = getAdminSectionUrl(activeAdminSection || 'dashboard');
                              navigateToRoute(targetUrl);
                              setProfileMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl px-2.5 py-2 text-xs text-indigo-600 dark:text-indigo-400 font-bold transition-all cursor-pointer text-left"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                            </svg>
                            Admin Panel
                          </button>
                        )}
                      </div>

                      <div className="border-t border-slate-150 dark:border-slate-800/80 my-1"></div>

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-655 dark:text-rose-455 rounded-xl py-2 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Main Content Viewport Switcher */}
        {activeTab === 'pricing' && renderPricingPage()}
        {['notes', 'tasks', 'reminders', 'documents', 'automation'].includes(activeTab) && (
          <div ref={workspaceContentRef} className="flex-1 flex flex-col min-h-0 overflow-hidden relative" style={{ zIndex: 45 }}>
            {activeTab === 'notes' && renderNotesPage()}
            {activeTab === 'tasks' && renderTasksPage()}
            {activeTab === 'reminders' && renderRemindersPage()}
            {activeTab === 'documents' && renderDocumentsPage()}
            {activeTab === 'automation' && renderAutomationPage()}
          </div>
        )}
        {activeTab === 'notifications' && renderNotificationsPage()}
        {activeTab === 'admin' && renderAdminPage()}

        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative h-full">
            <div
              ref={chatContainerRef}
              onScroll={handleChatScroll}
              className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 md:p-6"
            >
              {activeSession.messages.length === 0 ? (
                /* Welcome Banner */
                <div className="flex-1 flex flex-col items-center justify-center text-center max-w-xl mx-auto px-4">
                  <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 dark:from-slate-100 dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent">
                    Hi, how can I help you today?
                  </h1>
                </div>
              ) : (
                /* Message List */
                <div className="max-w-3xl mx-auto space-y-6 w-full">
                {activeSession.messages.map((message) => {
                  const isUser = message.sender === 'user';
                  return (
                    <div key={message.id} className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
                      <div className={`flex gap-2 items-center ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Message Bubble */}
                        <div
                          className={`relative max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm transition-all ${
                            isUser
                              ? 'bg-indigo-600 text-white rounded-br-none shadow-indigo-600/5'
                              : 'bg-slate-100 dark:bg-slate-900/60 dark:border dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-none'
                          }`}
                        >
                          {/* Top-Right Action Group for AI Responses: [Edit] [Share] [Copy] */}
                          {!isUser && (
                            <div className="float-right ml-3 mb-1 flex items-center gap-1 bg-slate-200/50 dark:bg-slate-800/60 rounded-full p-1 border border-slate-300/30 dark:border-slate-700/50 shadow-2xs select-none">
                              {/* Edit Button */}
                              <button
                                type="button"
                                aria-label="Edit AI response"
                                title="Edit response"
                                onClick={() => {
                                  setEditingMessageId(message.id);
                                  setEditingText(message.text);
                                }}
                                className="p-1 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-white/80 dark:hover:bg-slate-700 rounded-full transition-all cursor-pointer"
                              >
                                <EditIcon className="w-3.5 h-3.5" />
                              </button>

                              {/* Share Button */}
                              <button
                                type="button"
                                aria-label="Share AI response"
                                title="Share response"
                                onClick={() => setSharingSession(activeSession)}
                                className="p-1 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-white/80 dark:hover:bg-slate-700 rounded-full transition-all cursor-pointer"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                                </svg>
                              </button>

                              {/* Copy Button */}
                              <button
                                type="button"
                                aria-label="Copy AI response"
                                title={copiedMsgId === message.id ? "Copied!" : "Copy response"}
                                onClick={() => {
                                  navigator.clipboard.writeText(message.text);
                                  setCopiedMsgId(message.id);
                                  setTimeout(() => setCopiedMsgId(null), 2000);
                                }}
                                className="p-1 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-white/80 dark:hover:bg-slate-700 rounded-full transition-all cursor-pointer flex items-center gap-0.5"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.375v-3.5" />
                                </svg>
                                {copiedMsgId === message.id && (
                                  <span className="text-[9px] text-indigo-500 font-bold px-0.5 animate-fade-in">Copied!</span>
                                )}
                              </button>
                            </div>
                          )}

                          {editingMessageId === message.id ? (
                            <div className="space-y-2 min-w-[240px] sm:min-w-[320px] clear-both">
                              <textarea
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                className={`w-full p-2.5 rounded-xl border focus:outline-none text-xs leading-relaxed resize-y font-sans ${
                                  isUser
                                    ? 'bg-indigo-700 text-white border-indigo-400'
                                    : 'bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700'
                                }`}
                                rows={4}
                                autoFocus
                              />
                              <div className="flex justify-end items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingMessageId(null)}
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                                    isUser
                                      ? 'bg-indigo-500/40 hover:bg-indigo-500/60 text-white'
                                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                                  }`}
                                >
                                  Cancel
                                </button>

                                {!isUser && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMessageId(null);
                                      const msgIdx = activeSession.messages.findIndex(m => m.id === message.id);
                                      let userQuery = "";
                                      for (let i = msgIdx - 1; i >= 0; i--) {
                                        if (activeSession.messages[i].sender === 'user') {
                                          userQuery = activeSession.messages[i].text;
                                          break;
                                        }
                                      }
                                      if (userQuery) {
                                        handleSendMessage(userQuery);
                                      }
                                    }}
                                    className="px-2.5 py-1 text-[11px] font-bold bg-slate-200 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                    </svg>
                                    Regenerate
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!editingText.trim() || !activeSession) return;
                                    const newTxt = editingText.trim();
                                    setEditingMessageId(null);
                                    setSessions(prev => prev.map(s => {
                                      if (s.id !== activeSession.id) return s;
                                      return {
                                        ...s,
                                        messages: s.messages.map(m => m.id === message.id ? { ...m, text: newTxt } : m)
                                      };
                                    }));
                                    if (isUser) {
                                      handleSendMessage(newTxt);
                                    }
                                  }}
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all shadow-sm cursor-pointer ${
                                    isUser
                                      ? 'bg-white text-indigo-700 hover:bg-slate-100'
                                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                  }`}
                                >
                                  {isUser ? 'Save & Submit' : 'Save Changes'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {message.file && (
                                <div className="flex items-center gap-2 bg-slate-900/10 dark:bg-slate-950/20 border border-slate-900/10 dark:border-slate-800/40 rounded-xl p-2.5 mb-2 text-xs">
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 opacity-75 shrink-0">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                  </svg>
                                  <div className="truncate flex-1">
                                    <span className="font-semibold block truncate">{message.file.filename}</span>
                                    <span className="opacity-60 text-[10px] block mt-0.5">{(message.file.file_size / 1024 / 1024).toFixed(2)} MB • {message.file.file_type.toUpperCase()}</span>
                                  </div>
                                </div>
                              )}
                              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(message.text) }} className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed" />
                              
                              {message.image_url && (
                                <div className="mt-2.5 rounded-xl overflow-hidden border border-slate-250 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-1.5 shadow-sm max-w-sm animate-fade-in">
                                  <img 
                                    src={message.image_url} 
                                    alt="Generated Image" 
                                    className="w-full h-auto object-cover rounded-lg border border-slate-200/60 dark:border-slate-800 hover:scale-[1.01] transition-transform duration-200" 
                                  />
                                  <div className="p-1.5 flex justify-end">
                                    <a 
                                      href={message.image_url} 
                                      download={`generated-image-${message.id}.png`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline px-2 py-1 bg-indigo-500/10 rounded-lg cursor-pointer transition-all"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                      </svg>
                                      Download Image
                                    </a>
                                  </div>
                                </div>
                              )}
                              
                              {message.tool_info && (
                                <div className="mt-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm max-w-lg animate-fade-in text-slate-800 dark:text-slate-100">
                                  <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A1.5 1.5 0 0020 20l-5.83-5.83m-2.75 1.01l2.75-2.75m-2.75 2.75l-4.22-4.22m12.44-4.22L12 9.42M12 9.42L7.78 5.2m4.22 4.22v10.5m-8.44-12.7L12 7.78M12 7.78L16.22 3.56" />
                                    </svg>
                                    Tool Executed: {message.tool_info.name}
                                  </div>
                                  
                                  {message.tool_info.type === 'image' && (
                                    <div className="space-y-2">
                                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold truncate">Input: {message.tool_info.input}</div>
                                      <img src={message.tool_info.output} alt={message.tool_info.name} className="max-w-[200px] h-auto object-contain rounded-lg border border-slate-200 dark:border-slate-800 bg-white p-1" />
                                      <div className="flex justify-end">
                                        <a 
                                          href={message.tool_info.output} 
                                          download={`${message.tool_info.name.toLowerCase()}-${message.id}.png`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-650 dark:text-indigo-450 hover:underline cursor-pointer"
                                        >
                                          Download Asset
                                        </a>
                                      </div>
                                    </div>
                                  )}

                                  {message.tool_info.type === 'html' && (
                                    <div className="space-y-2">
                                      <div dangerouslySetInnerHTML={{ __html: message.tool_info.output }} className="prose prose-sm dark:prose-invert max-w-none text-xs" />
                                    </div>
                                  )}

                                  {message.tool_info.type === 'chart' && (
                                    (() => {
                                      try {
                                        const chartData = JSON.parse(message.tool_info.output);
                                        const maxVal = Math.max(...chartData.values, 1);
                                        return (
                                          <div className="space-y-3 mt-1">
                                            <div className="space-y-2">
                                              {chartData.labels.map((lbl: string, lidx: number) => {
                                                const val = chartData.values[lidx];
                                                const pct = (val / maxVal) * 100;
                                                return (
                                                  <div key={lidx} className="space-y-1">
                                                    <div className="flex justify-between text-[111px] font-semibold text-slate-700 dark:text-slate-350">
                                                      <span>{lbl}</span>
                                                      <span>{val}</span>
                                                    </div>
                                                    <div className="w-full bg-slate-200 dark:bg-slate-800/80 rounded-full h-2">
                                                      <div 
                                                        className="bg-indigo-600 dark:bg-indigo-505 h-2 rounded-full transition-all duration-500" 
                                                        style={{ width: `${pct}%` }} 
                                                      />
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      } catch (e) {
                                        return <div className="text-xs text-rose-500">Failed to render visual dataset.</div>;
                                      }
                                    })()
                                  )}

                                  {message.tool_info.type === 'text' && (
                                    <div className="bg-slate-100 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 p-2.5 rounded-lg font-mono text-xs whitespace-pre-wrap">
                                      {message.tool_info.output}
                                    </div>
                                  )}

                                  {message.tool_info.type === 'json' && (
                                    <div className="bg-slate-100 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 p-2.5 rounded-lg font-mono text-xs whitespace-pre-wrap">
                                      {message.tool_info.output}
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Web Search Sources list */}
                              {!isUser && message.sources && message.sources.length > 0 && (
                                <div className="mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-800/60 space-y-1.5 animate-fade-in">
                                  <div className="flex items-center gap-1 text-[9px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
                                    </svg>
                                    Search sources ({message.sources.length})
                                  </div>
                                  <div className="grid grid-cols-1 gap-1">
                                    {message.sources.map((src, sidx) => {
                                      const srcTime = src.timestamp ? new Date(src.timestamp) : new Date();
                                      return (
                                        <div key={sidx} className="flex flex-col bg-white/50 dark:bg-slate-950/20 p-2 rounded-xl border border-slate-200/40 dark:border-slate-800/40 text-[10px] space-y-0.5 shadow-sm">
                                          <a
                                            href={src.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-bold text-indigo-650 dark:text-indigo-400 hover:underline truncate block"
                                          >
                                            {src.title || "Grounded Source Link"}
                                          </a>
                                          <span className="text-[8px] text-slate-400 dark:text-slate-500 truncate block">
                                            {src.url} • {srcTime.toLocaleDateString()} {srcTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Background Knowledge Indicator (Compact Collapsible UI) */}
                              {!isUser && message.used_sources && message.used_sources.length > 0 && (
                                <details className="mt-2 pt-1.5 border-t border-slate-200/40 dark:border-slate-800/40 group">
                                  <summary className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold cursor-pointer flex items-center gap-1.5 select-none hover:underline">
                                    <span>🧠 Referenced {message.used_sources.length} memory source{message.used_sources.length > 1 ? 's' : ''}</span>
                                    <span className="text-[8px] opacity-70 group-open:rotate-180 transition-transform">▼</span>
                                  </summary>
                                  <div className="flex flex-wrap gap-1 mt-1.5 pl-1">
                                    {message.used_sources.map((src, sidx) => (
                                      <span key={sidx} className="bg-slate-200/50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-[8px] font-semibold px-2 py-0.5 rounded-md truncate max-w-[160px]" title={src.title}>
                                        📄 {src.title}
                                      </span>
                                    ))}
                                  </div>
                                </details>
                              )}
                            </>
                          )}
                        </div>

                        {/* Edit Button for USER Message */}
                        {isUser && editingMessageId !== message.id && (
                          <button
                            type="button"
                            aria-label="Edit user message"
                            title="Edit message"
                            onClick={() => {
                              setEditingMessageId(message.id);
                              setEditingText(message.text);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all cursor-pointer opacity-70 hover:opacity-100"
                          >
                            <EditIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Action Toolbar for AI Responses: Like, Dislike, Copy */}
                      {!isUser && (
                        <div className="flex items-center gap-1 mt-1 pl-1">
                          {/* Like Button */}
                          <button
                            type="button"
                            aria-label="Like response"
                            title={likedMessages[message.id] === 'like' ? "Liked" : "Like response"}
                            onClick={() => {
                              setLikedMessages(prev => ({
                                ...prev,
                                [message.id]: prev[message.id] === 'like' ? undefined : 'like'
                              }));
                            }}
                            className={`p-1.5 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                              likedMessages[message.id] === 'like'
                                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill={likedMessages[message.id] === 'like' ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V2.75a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.767-1.62.767H12.75a3 3 0 01-3-3V11.25M6.633 10.25h-2.25c-1.026 0-1.945.694-2.054 1.715A12.334 12.334 0 002 14.25c0 1.294.205 2.54.582 3.715.109 1.021 1.028 1.715 2.054 1.715h2.25" />
                            </svg>
                          </button>

                          {/* Dislike Button */}
                          <button
                            type="button"
                            aria-label="Dislike response"
                            title={likedMessages[message.id] === 'dislike' ? "Disliked" : "Dislike response"}
                            onClick={() => {
                              setLikedMessages(prev => ({
                                ...prev,
                                [message.id]: prev[message.id] === 'dislike' ? undefined : 'dislike'
                              }));
                            }}
                            className={`p-1.5 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                              likedMessages[message.id] === 'dislike'
                                ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20'
                                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill={likedMessages[message.id] === 'dislike' ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.367 13.75c-.806 0-1.533.446-2.031 1.08a9.041 9.041 0 01-2.861 2.4c-.723.384-1.35.956-1.653 1.715a4.498 4.498 0 00-.322 1.672v.5c0 .414-.336.75-.75.75a2.25 2.25 0 01-2.25-2.25c0-1.152.26-2.243.723-3.218.266-.558-.107-1.282-.725-1.282H4.368c-1.026 0-1.945-.694-2.054-1.715A12.334 12.334 0 012 9.75c0-1.294.205-2.54.582-3.715C2.691 5.014 3.61 4.32 4.636 4.32h5.114a3 3 0 013 3v3.08m4.617 3.35h2.25c1.026 0 1.945-.694 2.054-1.715.377-1.175.582-2.421.582-3.715 0-1.294-.205-2.54-.582-3.715C21.309 4.32 20.39 3.626 19.364 3.626h-2.25" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Typing Indicator */}
                {isTyping && (
                  <div className="flex gap-4 justify-start animate-fade-in">
                    <div className="bg-slate-100 dark:bg-slate-900/60 dark:border dark:border-slate-800 rounded-2xl px-4 py-3 text-sm flex items-center gap-1.5 shadow-sm rounded-bl-none">
                      <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
            </div>

            {/* Input Bar Console */}
            <div className="bg-white/40 dark:bg-slate-950/40 backdrop-blur-md border-t border-slate-200 dark:border-slate-800/60 p-4 shrink-0 z-20">
              {plusMenuOpen && (
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setPlusMenuOpen(false)} 
                />
              )}
              <div className="max-w-3xl mx-auto relative">
            
            {/* Recording Banner Alert */}
            {isRecording && (
              <div className="absolute top-[-44px] left-1/2 -translate-x-1/2 bg-rose-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg shadow-rose-500/10 animate-bounce">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                {voiceStatusText}
              </div>
            )}

            {/* File Upload Preview capsule */}
            {selectedFile && (
              <div className="absolute top-[-52px] left-0 right-0 flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl px-4 py-2.5 text-xs shadow-md transition-all z-30">
                <div className="flex items-center gap-2.5 truncate flex-1 mr-4">
                  {selectedFile.type.startsWith('image/') ? (
                    <img 
                      src={URL.createObjectURL(selectedFile)} 
                      alt="Thumbnail Preview" 
                      className="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-slate-800 shrink-0 shadow-sm"
                    />
                  ) : (
                    <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                  )}
                  <div className="truncate flex-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                      {selectedFile.name}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      {uploadProgress !== null && ` • Uploading ${uploadProgress}%`}
                      {uploadedFileInfo && " • Ready"}
                      {uploadError && ` • Error: ${uploadError}`}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  title="Remove file"
                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-all"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Web Search Active Indicator */}
            {webSearchEnabled && (
              <div className="flex items-center gap-2 text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-xl self-start mb-2 animate-fade-in shadow-sm">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                </span>
                <span>WEB SEARCH ACTIVE (Generates live internet grounded responses)</span>
              </div>
            )}

            {/* Image Generation Active Indicator */}
            {imageGenEnabled && (
              <div className="flex items-center gap-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl self-start mb-2 animate-fade-in shadow-sm">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span>IMAGE GENERATION ACTIVE (Enter a prompt to generate an image)</span>
              </div>
            )}

            {/* Input Wrapper Card */}
            <div className="relative flex items-end w-full border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 rounded-2xl p-1.5 pr-12 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/25 focus-within:border-indigo-500 transition-all">
              
              {/* Plus (+) Menu Trigger Button */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={togglePlusMenu}
                  title="More options"
                  aria-label="More options"
                  className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                    plusMenuOpen 
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100' 
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <PlusIcon className="w-4 h-4" />
                </button>

                {/* Popover Menu */}
                {plusMenuOpen && (
                  <div ref={plusMenuRef} className="absolute bottom-[calc(100%+12px)] left-0 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2.5 z-50 flex flex-col gap-1 animate-in slide-in-from-bottom-2 duration-150">


                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerCamera();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl cursor-pointer transition-all text-left"
                      title="Camera"
                      aria-label="Camera"
                    >
                      <span className="text-sm shrink-0">📷</span>
                      <span className="truncate">Camera</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlusMenuOpen(false);
                        photosInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl cursor-pointer transition-all text-left"
                      title="Photos"
                      aria-label="Photos"
                    >
                      <span className="text-sm shrink-0">🖼️</span>
                      <span className="truncate">Photos</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlusMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl cursor-pointer transition-all text-left"
                      title="Files"
                      aria-label="Files"
                    >
                      <span className="text-sm shrink-0">📄</span>
                      <span className="truncate">Files</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlusMenuOpen(false);
                        setWebSearchEnabled((prev) => !prev);
                        if (!webSearchEnabled) setImageGenEnabled(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-xl cursor-pointer transition-all text-left ${
                        webSearchEnabled 
                          ? 'bg-indigo-500/10 text-indigo-650 dark:text-indigo-400' 
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                      title="Web Search"
                      aria-label="Web Search"
                    >
                      <span className="text-sm shrink-0">🌐</span>
                      <span className="truncate">Web Search</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlusMenuOpen(false);
                        setImageGenEnabled((prev) => !prev);
                        if (!imageGenEnabled) setWebSearchEnabled(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-xl cursor-pointer transition-all text-left ${
                        imageGenEnabled 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                      title="Image Generation"
                      aria-label="Image Generation"
                    >
                      <span className="text-sm shrink-0">🎨</span>
                      <span className="truncate">Image Generation</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Message AI Mega Assistant..."
                rows={1}
                className="flex-1 max-h-40 min-h-[38px] bg-transparent resize-none border-0 outline-none text-slate-800 dark:text-slate-100 py-2 px-3 focus:ring-0 text-sm leading-relaxed"
              />

              {/* Mic Icon (UI Only) */}
              <button
                type="button"
                onClick={handleVoiceClick}
                title="Voice Input"
                className={`p-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
                  isRecording 
                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <MicIcon className="w-4 h-4" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,.py,.js,.ts,.java,.cpp,.html,.css,.json"
                onChange={handleFileChange}
              />
              <input
                ref={photosInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />

              {/* Send Button */}
              <button
                type="button"
                disabled={(!inputValue.trim() && !uploadedFileInfo) || isTyping || (!!selectedFile && !uploadedFileInfo && !uploadError)}
                onClick={handleSendMessage}
                className={`absolute right-1.5 bottom-1.5 p-2 rounded-xl text-white disabled:opacity-30 transition-all cursor-pointer ${getThemeClasses(themePref).primary}`}
              >
                <SendIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Footer warning info */}
            <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 mt-2 tracking-wider">
              Mega Assistant Developer console. Integration active. Local sandbox responses.
            </p>
          </div>
        </div>
        </div>
        )}
      </main>

      {/* Camera Capture Modal */}
      {isCameraActive && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div ref={cameraModalRef} className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 flex flex-col gap-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>📷 Capture Photo</span>
              </h3>
              <button
                type="button"
                onClick={closeCamera}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover ${useFrontCameraMode ? 'scale-x-[-1]' : ''}`}
              />
            </div>

            <div className="flex justify-between items-center gap-3">
              <div>
                {(cameraDevices.length > 1 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) && (
                  <button
                    type="button"
                    onClick={switchCamera}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-250 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 border border-slate-200 dark:border-slate-800"
                    title="Switch Camera"
                    aria-label="Switch Camera"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 animate-spin-hover">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    <span>Switch Camera</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeCamera}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={takePhoto}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-650 hover:bg-indigo-700 rounded-xl cursor-pointer transition-all shadow-md shadow-indigo-650/10 flex items-center gap-1.5"
                >
                  <span>Capture</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showCheckoutModal && selectedPlanForUpgrade && (
        <div className="fixed inset-0 bg-slate-955/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-hidden">
          {/* Top-Right Fixed Close Button (remains visible while scrolling) */}
          <button
            onClick={() => {
              setShowCheckoutModal(false);
              setCheckoutError(null);
              setCheckoutSuccess(false);
            }}
            disabled={checkoutProcessing}
            className="fixed top-4 right-4 md:top-6 md:right-6 p-2.5 rounded-full bg-slate-955 hover:bg-slate-850 text-slate-300 hover:text-white transition-all cursor-pointer shadow-lg active:scale-95 border border-slate-800 disabled:opacity-50 disabled:cursor-not-allowed z-[60] flex items-center justify-center font-sans select-none"
            title="Close checkout"
            aria-label="Close checkout"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 md:p-8 space-y-6 animate-in zoom-in-95 duration-200 text-slate-100 relative max-h-[90vh] md:max-h-[85vh] overflow-y-auto">
            {checkoutSuccess ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center space-y-4">
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center text-xl font-bold border border-emerald-500/20">✓</div>
                <h3 className="text-lg font-black text-white">Plus trial activated</h3>
                <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                  Your AI Mega Assistant Plus trial is now active. You now have full access to advanced AI models and features.
                </p>
                {subscription?.subscription_end && (
                  <p className="text-xs text-slate-500">
                    Trial ends on: <strong className="text-slate-300">{new Date(subscription.subscription_end).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                  </p>
                )}
                <button 
                  onClick={() => setShowCheckoutModal(false)} 
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-md shadow-indigo-600/10 mt-2"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* LEFT COLUMN: Payment Method + Fields (7 columns on md) */}
                <div className="md:col-span-7 space-y-6">
                  {/* Header */}
                  <div>
                    <h3 className="text-xl font-black text-white tracking-tight">Start your free Plus trial</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Unlock AI Mega Assistant Plus for your first month free.
                    </p>
                  </div>

                  {/* Demo Mode Notice */}
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 flex flex-col gap-1 text-[11.5px] text-amber-400 font-sans">
                    <strong className="font-extrabold uppercase tracking-wide">DEMO PAYMENT MODE ACTIVE</strong>
                    <p className="leading-relaxed text-slate-300">
                      No real money will be charged during this evaluation.
                    </p>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Pay with</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'card', label: 'Card' },
                        { id: 'upi', label: 'UPI' },
                        { id: 'netbanking', label: 'Net Banking' }
                      ].map((method) => {
                        const isSelected = selectedPaymentMethod === method.id;
                        return (
                          <button
                            key={method.id}
                            type="button"
                            disabled={checkoutProcessing}
                            onClick={() => setSelectedPaymentMethod(method.id as any)}
                            className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer text-xs font-bold select-none active:scale-[0.98] ${
                              isSelected
                                ? 'border-indigo-500 bg-indigo-950/20 text-white shadow-sm shadow-indigo-500/10'
                                : 'border-slate-800 bg-slate-950/20 text-slate-400 hover:border-slate-700/60 hover:text-slate-200'
                            }`}
                          >
                            {method.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Payment Inputs Area */}
                  <div className="space-y-4 min-h-[160px]">
                    {selectedPaymentMethod === 'card' && (
                      <div className="space-y-3.5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Card number</label>
                          <input
                            type="text"
                            maxLength={19}
                            value={cardNumber}
                            disabled={checkoutProcessing}
                            onChange={(e) => setCardNumber(e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim())}
                            placeholder="1234 1234 1234 1234"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Expiry date</label>
                            <input
                              type="text"
                              maxLength={5}
                              value={cardExpiry}
                              disabled={checkoutProcessing}
                              onChange={(e) => {
                                let val = e.target.value.replace(/\D/g, '');
                                if (val.length >= 2) {
                                  val = val.slice(0, 2) + '/' + val.slice(2, 4);
                                }
                                setCardExpiry(val);
                              }}
                              placeholder="MM / YY"
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Security code</label>
                            <input
                              type="password"
                              maxLength={4}
                              value={cardCvc}
                              disabled={checkoutProcessing}
                              onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ''))}
                              placeholder="CVC"
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cardholder name</label>
                          <input
                            type="text"
                            value={cardName}
                            disabled={checkoutProcessing}
                            onChange={(e) => setCardName(e.target.value)}
                            placeholder="Name on card"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-655 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                          />
                        </div>
                      </div>
                    )}

                    {selectedPaymentMethod === 'upi' && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">UPI ID / VPA</label>
                        <input
                          type="text"
                          disabled={checkoutProcessing}
                          placeholder="username@bank"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                        />
                        <p className="text-[9px] text-slate-500 leading-normal">
                          A collect request will be sent to your UPI app during checkout.
                        </p>
                      </div>
                    )}

                    {selectedPaymentMethod === 'netbanking' && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Select your Bank</label>
                        <select 
                          disabled={checkoutProcessing}
                          className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-350 focus:outline-none focus:border-indigo-500 disabled:opacity-50 cursor-pointer"
                        >
                          <option value="">Choose a bank...</option>
                          <option value="sbi">State Bank of India</option>
                          <option value="hdfc">HDFC Bank</option>
                          <option value="icici">ICICI Bank</option>
                          <option value="axis">Axis Bank</option>
                          <option value="kotak">Kotak Mahindra Bank</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Save payment details */}
                  <div className="flex items-start gap-3 bg-slate-950/20 border border-slate-850/50 p-3.5 rounded-2xl">
                    <input
                      type="checkbox"
                      id="save-payment"
                      checked={savePaymentDetails}
                      disabled={checkoutProcessing}
                      onChange={(e) => setSavePaymentDetails(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 accent-indigo-650 cursor-pointer disabled:opacity-50"
                    />
                    <label htmlFor="save-payment" className="text-xs text-slate-350 cursor-pointer select-none leading-normal">
                      <strong className="text-white block font-bold">Save payment details securely for future purchases</strong>
                      <span className="text-[10px] text-slate-500 mt-0.5 block leading-relaxed">
                        Your payment information is securely handled by our payment provider.
                      </span>
                    </label>
                  </div>
                </div>

                {/* RIGHT COLUMN: Plan summary + Price summary (5 columns on md) */}
                <div className="md:col-span-5 space-y-6 md:border-l md:border-slate-800 md:pl-6">
                  {/* Plus Plan Summary */}
                  <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl space-y-3">
                    <div>
                      <h4 className="text-xs font-black text-indigo-400 uppercase tracking-wider">AI Mega Assistant Plus</h4>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">Top features</p>
                    </div>
                    <div className="space-y-1.5 text-[10.5px] text-slate-300">
                      {[
                        "Expanded messaging and uploads",
                        "More image creation",
                        "Deep research",
                        "AI coding assistance",
                        "AI workflow automation",
                        "Expanded memory",
                        "Priority processing"
                      ].map((f, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-indigo-500 font-bold">✓</span>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Price Summary */}
                  <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl space-y-2 text-xs">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-855/50 pb-1.5">Order summary</h4>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Monthly subscription</span>
                      <span className="text-slate-300 font-medium">₹899</span>
                    </div>
                    {checkoutPromoActive && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Promotion</span>
                        <span className="font-bold text-emerald-400">-₹899</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400">Estimated tax</span>
                      <span className="text-slate-300">₹0</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-slate-855/50 pt-2 text-white text-sm">
                      <span>Due today</span>
                      <span className="text-indigo-400 font-black">₹0</span>
                    </div>

                    {checkoutPromoActive && (
                      <div className="mt-3 pt-2.5 border-t border-indigo-500/20 text-slate-450 leading-relaxed text-[9.5px]">
                        <strong className="text-amber-400 block font-bold mb-1">Payment verification</strong>
                        <div className="flex justify-between text-slate-350 mb-1">
                          <span>₹1 temporary verification</span>
                          <span className="font-semibold text-slate-200">₹1</span>
                        </div>
                        A temporary ₹1 verification may be made to verify your payment method. The verification amount will be refunded according to the payment provider's refund process.
                      </div>
                    )}
                  </div>

                  {/* Success / Error Messages */}
                  {checkoutError && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl p-3.5 leading-normal text-left font-medium">
                      ⚠️ {checkoutError}
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="space-y-3.5">
                    {/* Demo failure simulation checkbox */}
                    <div className="flex items-center gap-2 bg-slate-950/40 border border-slate-800 p-3 rounded-2xl">
                      <input
                        type="checkbox"
                        id="simulate-fail"
                        checked={simulateFailure}
                        disabled={checkoutProcessing}
                        onChange={(e) => setSimulateFailure(e.target.checked)}
                        className="w-3.5 h-3.5 accent-indigo-650 cursor-pointer disabled:opacity-50"
                      />
                      <label htmlFor="simulate-fail" className="text-xs text-slate-350 cursor-pointer select-none leading-normal font-bold">
                        Simulate payment failure (Demo Testing)
                      </label>
                    </div>

                    <button
                      type="button"
                      disabled={checkoutProcessing}
                      onClick={() => {
                        if (selectedPaymentMethod === 'card') {
                          if (!cardNumber.trim()) {
                            setCheckoutError("Please enter your card number.");
                            return;
                          }
                          if (!cardExpiry.trim()) {
                            setCheckoutError("Please enter the expiry date.");
                            return;
                          }
                          if (!cardCvc.trim()) {
                            setCheckoutError("Please enter your security code.");
                            return;
                          }
                          if (!cardName.trim()) {
                            setCheckoutError("Please enter the cardholder name.");
                            return;
                          }
                        }
                        executeCheckout(
                          selectedPlanForUpgrade.id,
                          'monthly',
                          selectedPaymentMethod!,
                          checkoutPromoActive
                        );
                      }}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl cursor-pointer shadow-md shadow-indigo-600/10 transition-all active:scale-[0.98] select-none uppercase tracking-wider font-bold"
                    >
                      {checkoutProcessing 
                        ? (demoProgress || (checkoutPromoActive ? "Processing payment..." : "Processing...")) 
                        : "Start Plus"}
                    </button>

                    <button
                      type="button"
                      disabled={checkoutProcessing}
                      onClick={() => {
                        setShowCheckoutModal(false);
                        setCheckoutError(null);
                        setCheckoutSuccess(false);
                      }}
                      className="w-full py-2.5 bg-slate-950 hover:bg-slate-850 text-slate-350 border border-slate-800 text-xs font-bold rounded-xl cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 text-center uppercase tracking-wider font-bold"
                    >
                      Cancel
                    </button>

                    {/* Terms / Billing Notice */}
                    <p className="text-[9.5px] text-slate-500 leading-relaxed text-center px-1">
                      ₹0 for 1 month, then ₹899/month. Renews monthly until cancelled. Cancel anytime before your trial ends to avoid the next charge. By clicking "Start Plus", you agree to our{" "}
                      <a href="#" className="text-indigo-400 hover:underline">Terms of Use</a>,{" "}
                      <a href="#" className="text-indigo-400 hover:underline">Promo Terms</a>, and{" "}
                      <a href="#" className="text-indigo-400 hover:underline">Privacy Policy</a>.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div ref={helpModalRef} className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>ℹ️ Help & Hotkeys</span>
              </h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-650 dark:text-slate-300">
              <p className="leading-relaxed">
                Welcome to **AI Mega Assistant**! Our platform integrates specialized AI routing agent, persistent memory vault, natural language workflows, and complete document workspaces in one place.
              </p>
              
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-2 uppercase tracking-wider text-[10px]">Command Guide</h4>
                <ul className="space-y-1.5 list-disc pl-4 text-[11px]">
                  <li>Ask coding questions to automatically switch to the Coding agent.</li>
                  <li>Type `"remember that I prefer React"` to save items in memory.</li>
                  <li>Say `"Continue the previous topic"` to switch back to Python/Coding.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-2 uppercase tracking-wider text-[10px]">Shortcuts</h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                    <span>New Chat</span>
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-900 border rounded font-semibold text-[9px]">Ctrl + N</kbd>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                    <span>Voice Input</span>
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-900 border rounded font-semibold text-[9px]">Ctrl + V</kbd>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-250 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 transition-all cursor-pointer text-center"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* User Profile Dialog Modal */}
      {/* User Profile Dialog Modal */}
      {showProfileDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div ref={profileDialogRef} className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-850">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isEditingProfile ? "Edit Profile Settings" : "My Profile Overview"}
              </h3>
              <button
                onClick={() => closeRouteDialog('profile')}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-805 cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {authError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs px-3.5 py-2.5 rounded-xl animate-fade-in">
                {authError}
              </div>
            )}
            {authSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs px-3.5 py-2.5 rounded-xl animate-fade-in">
                {authSuccess}
              </div>
            )}

            {!isEditingProfile ? (
              /* ================= READ-ONLY PROFILE OVERVIEW ================= */
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-850/50">
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt="Profile Avatar"
                      className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 dark:border-slate-750 shadow-md shrink-0"
                    />
                  ) : (
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-tr ${getThemeClasses(themePref).avatarBg} flex items-center justify-center text-white text-2xl font-bold shadow-md shrink-0`}>
                      {getInitials(user?.name)}
                    </div>
                  )}
                  
                  <div className="text-center sm:text-left min-w-0 flex-1">
                    <h4 className="text-base font-extrabold text-slate-900 dark:text-white truncate">{user?.name}</h4>
                    <span className="block text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-0.5 truncate">{user?.username || "@username"}</span>
                    <span className="block text-[11px] text-slate-400 truncate mt-0.5">{user?.email}</span>
                  </div>

                  <span className="bg-violet-500/15 text-violet-600 dark:text-violet-400 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider self-center border border-violet-500/10 shrink-0">
                    {user?.account_type || "Free Plan"}
                  </span>
                </div>

                {/* Profile Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850/50 rounded-xl space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Phone Number</span>
                    <span className="block text-slate-800 dark:text-slate-200 font-medium">{user?.phone || "Not provided"}</span>
                  </div>
                  <div className="p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850/50 rounded-xl space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Country</span>
                    <span className="block text-slate-800 dark:text-slate-200 font-medium">{user?.country || "Not specified"}</span>
                  </div>
                  <div className="p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850/50 rounded-xl space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Preferred Language</span>
                    <span className="block text-slate-800 dark:text-slate-200 font-medium">{user?.language || "English"}</span>
                  </div>
                  <div className="p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850/50 rounded-xl space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Time Zone</span>
                    <span className="block text-slate-800 dark:text-slate-200 font-medium">{user?.timezone || "UTC"}</span>
                  </div>
                  <div className="p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850/50 rounded-xl space-y-1 sm:col-span-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Bio Statement</span>
                    <p className="text-slate-655 dark:text-slate-350 leading-relaxed font-medium">{user?.bio || "No bio statement written yet."}</p>
                  </div>
                  <div className="p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850/50 rounded-xl space-y-1 sm:col-span-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Member Since</span>
                    <span className="block text-slate-805 dark:text-slate-200 font-medium">
                      {user?.member_since ? new Date(user.member_since).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : "Recently"}
                    </span>
                  </div>
                  
                  <div className="p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850/50 rounded-xl space-y-2 sm:col-span-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Current Plan</span>
                        <span className="block text-slate-805 dark:text-slate-200 font-bold text-xs mt-0.5 capitalize">
                          {subscription 
                            ? subscription.current_plan === 'free' ? 'AI Mega Assistant Free'
                              : subscription.current_plan === 'go' ? 'AI Mega Assistant Go'
                              : subscription.current_plan === 'plus' ? 'AI Mega Assistant Plus'
                              : 'AI Mega Assistant Pro'
                            : 'AI Mega Assistant Free'}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setShowProfileDialog(false);
                          setActiveTab('pricing');
                          window.history.pushState({}, '', '/pricing');
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-bold transition-all shadow-sm cursor-pointer active:scale-95"
                      >
                        Manage Plan
                      </button>
                    </div>

                    {subscription && subscription.current_plan !== 'free' && (
                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-850/40 text-[11px]">
                        <div>
                          <span className="text-[9px] text-slate-455 font-bold block">Status</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            subscription.subscription_status === 'trialing' ? 'text-amber-500' : 'text-emerald-500'
                          }`}>
                            {subscription.subscription_status === 'trialing' ? 'Trial Active' : subscription.subscription_status}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-455 font-bold block">Billing Cycle</span>
                          <span className="font-medium text-slate-700 dark:text-slate-350 capitalize">{subscription.billing_cycle}</span>
                        </div>
                        {subscription.subscription_end && (
                          <div className="col-span-2">
                            <span className="text-[9px] text-slate-455 font-bold block">
                              {subscription.subscription_status === 'trialing' ? 'Trial Ends On' : 'Next Renewal / Expiration'}
                            </span>
                            <span className="font-medium text-slate-700 dark:text-slate-350">
                              {new Date(subscription.subscription_end).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Billing History Section */}
                <div className="border-t border-slate-100 dark:border-slate-850/80 pt-4 mt-1 space-y-3">
                  <h5 className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Billing & Invoice History</h5>
                  
                  {subscriptionHistory.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {subscriptionHistory.map((hist: any, hIdx: number) => (
                        <div key={hIdx} className="flex justify-between items-center p-2.5 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850/50 rounded-xl text-xs">
                          <div>
                            <div className="font-bold text-slate-800 dark:text-slate-200">{hist.plan_name}</div>
                            <div className="text-[9px] text-slate-400">Ref: {hist.reference}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-indigo-650 dark:text-indigo-400">{hist.amount}</div>
                            <div className="text-[10px] text-slate-400">{hist.date} • <span className="text-emerald-500 font-bold">{hist.status}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850/50 rounded-xl text-xs text-slate-400 italic text-center">
                      No invoices or past transactions recorded.
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="flex flex-wrap gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-850/80">
                  <button
                    onClick={() => {
                      setEditProfileName(user?.name || '');
                      setEditProfileAvatar(user?.avatar || '');
                      setEditProfileUsername(user?.username || "@" + user?.name.toLowerCase().replace(" ", ""));
                      setEditProfileBio(user?.bio || '');
                      setEditProfilePhone(user?.phone || '');
                      setEditProfileCountry(user?.country || '');
                      setEditProfileLanguage(user?.language || 'English');
                      setEditProfileTimezone(user?.timezone || 'UTC');
                      setIsEditingProfile(true);
                    }}
                    className={`flex-1 min-w-[120px] text-white text-xs font-semibold py-2.5 rounded-xl transition-all cursor-pointer text-center ${getThemeClasses(themePref).primary}`}
                  >
                    ✏️ Edit Profile
                  </button>
                  <button
                    onClick={() => {
                      setActiveSettingsTab('security');
                      setShowSettingsDialog(true);
                      setShowProfileDialog(false);
                    }}
                    className="flex-1 min-w-[120px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2.5 rounded-xl transition-colors cursor-pointer"
                  >
                    🔑 Change Password
                  </button>

                  <button
                    onClick={handleAccountDeletion}
                    className="flex-1 min-w-[120px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-semibold py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    ⚠️ Delete Account
                  </button>
                </div>
              </div>
            ) : (
              /* ================= INLINE EDIT PROFILE FORM ================= */
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                {/* Photo editing controls */}
                <div className="flex items-center gap-4 py-2 border-b border-slate-100 dark:border-slate-850/80 pb-4">
                  {editProfileAvatar ? (
                    <img
                      src={editProfileAvatar}
                      alt="Edit Preview"
                      className="w-16 h-16 rounded-full object-cover border border-slate-200 dark:border-slate-800 shadow-md shrink-0"
                    />
                  ) : (
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-tr ${getThemeClasses(themePref).avatarBg} flex items-center justify-center text-white text-xl font-bold shadow-md shrink-0`}>
                      {getInitials(editProfileName)}
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <label className={`px-3 py-1.5 text-white rounded-xl text-xs font-bold active:scale-[0.98] transition-all cursor-pointer shadow-sm ${getThemeClasses(themePref).primary}`}>
                      Upload Photo
                      <input
                        type="file"
                        className="hidden"
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        onChange={handleAvatarFileChange}
                      />
                    </label>
                    {editProfileAvatar && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={editProfileName}
                      onChange={(e) => setEditProfileName(e.target.value)}
                      className={`w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all ${getThemeClasses(themePref).ring}`}
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Username</label>
                    <input
                      type="text"
                      required
                      value={editProfileUsername}
                      onChange={(e) => handleUsernameChange(e.target.value)}
                      className={`w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all ${getThemeClasses(themePref).ring}`}
                    />
                    {checkingUsername && <span className="text-[9px] text-slate-400 block mt-1">Checking availability...</span>}
                    {!checkingUsername && usernameAvailable === true && <span className="text-[9px] text-emerald-500 dark:text-emerald-450 block mt-1">✓ Username is available</span>}
                    {!checkingUsername && usernameAvailable === false && <span className="text-[9px] text-rose-500 dark:text-rose-450 block mt-1">✗ Username already taken</span>}
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. +1 555-0199"
                      value={editProfilePhone}
                      onChange={(e) => setEditProfilePhone(e.target.value)}
                      className={`w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all ${getThemeClasses(themePref).ring}`}
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Country</label>
                    <input
                      type="text"
                      placeholder="e.g. United States"
                      value={editProfileCountry}
                      onChange={(e) => setEditProfileCountry(e.target.value)}
                      className={`w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all ${getThemeClasses(themePref).ring}`}
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Preferred Language</label>
                    <select
                      value={editProfileLanguage}
                      onChange={(e) => setEditProfileLanguage(e.target.value)}
                      className={`w-full bg-slate-50 dark:bg-slate-950 text-slate-905 dark:text-slate-105 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none transition-all ${getThemeClasses(themePref).ring}`}
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Español</option>
                      <option value="French">Français</option>
                      <option value="German">Deutsch</option>
                      <option value="Hindi">हिन्दी</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Time Zone</label>
                    <select
                      value={editProfileTimezone}
                      onChange={(e) => setEditProfileTimezone(e.target.value)}
                      className={`w-full bg-slate-50 dark:bg-slate-950 text-slate-905 dark:text-slate-105 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none transition-all ${getThemeClasses(themePref).ring}`}
                    >
                      <option value="UTC">UTC (GMT+0)</option>
                      <option value="GMT-5">EST (GMT-5)</option>
                      <option value="GMT-8">PST (GMT-8)</option>
                      <option value="GMT+1">CET (GMT+1)</option>
                      <option value="GMT+5.5">IST (GMT+5:30)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Bio Statement</label>
                    <textarea
                      rows={2}
                      placeholder="Write a brief bio..."
                      value={editProfileBio}
                      onChange={(e) => setEditProfileBio(e.target.value)}
                      className={`w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs outline-none transition-all ${getThemeClasses(themePref).ring}`}
                    />
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-850/80">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-xl py-2.5 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`flex-1 text-white rounded-xl py-2.5 text-xs font-semibold transition-all cursor-pointer ${getThemeClasses(themePref).primary}`}
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* User Profile Picture Cropping overlay modal */}
      {cropImageSrc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-6 animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b pb-2">Crop & Preview Photo</h3>
            
            {/* Circle crop mask container */}
            <div 
              className="relative w-48 h-48 mx-auto rounded-full border border-slate-200 dark:border-slate-800 overflow-hidden cursor-move bg-slate-100 dark:bg-slate-950 flex items-center justify-center"
              onMouseDown={(e) => {
                setIsDraggingCrop(true);
                setDragStartPos({ x: e.clientX - cropOffsetX, y: e.clientY - cropOffsetY });
              }}
              onMouseMove={(e) => {
                if (isDraggingCrop) {
                  setCropOffsetX(e.clientX - dragStartPos.x);
                  setCropOffsetY(e.clientY - dragStartPos.y);
                }
              }}
              onMouseUp={() => setIsDraggingCrop(false)}
              onMouseLeave={() => setIsDraggingCrop(false)}
              onTouchStart={(e) => {
                if (e.touches[0]) {
                  setIsDraggingCrop(true);
                  setDragStartPos({ x: e.touches[0].clientX - cropOffsetX, y: e.touches[0].clientY - cropOffsetY });
                }
              }}
              onTouchMove={(e) => {
                if (isDraggingCrop && e.touches[0]) {
                  setCropOffsetX(e.touches[0].clientX - dragStartPos.x);
                  setCropOffsetY(e.touches[0].clientY - dragStartPos.y);
                }
              }}
              onTouchEnd={() => setIsDraggingCrop(false)}
            >
              <img
                src={cropImageSrc}
                alt="Source Crop"
                className="absolute max-w-none select-none pointer-events-none"
                style={{
                  transform: `translate(${cropOffsetX}px, ${cropOffsetY}px) scale(${cropZoom})`,
                  maxWidth: '100%',
                  maxHeight: '100%',
                }}
              />
            </div>

            {/* Slider zoom */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest">
                <span>Zoom Scale</span>
                <span>{cropZoom.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={cropZoom}
                onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-650"
              />
              <p className="text-[9px] text-slate-400 text-center mt-1">Drag the photo inside the circle to adjust placement.</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCropImageSrc(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-xl py-2 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyCrop}
                className={`flex-1 text-white rounded-xl py-2 text-xs font-semibold cursor-pointer ${getThemeClasses(themePref).primary}`}
              >
                Apply Crop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Another Account Dialog Modal */}
      {showAddAccountDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in-50 duration-150">
          <div ref={addAccountDialogRef} className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-850">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add Another Account</h3>
              <button
                type="button"
                onClick={() => closeRouteDialog('addAccount')}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-805 cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {addAccountError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs p-3 rounded-xl">
                {addAccountError}
              </div>
            )}

            <form onSubmit={handleAddAccountSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={addAccountEmail}
                  onChange={(e) => setAddAccountEmail(e.target.value)}
                  className={`w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all ${getThemeClasses(themePref).ring}`}
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={addAccountPassword}
                  onChange={(e) => setAddAccountPassword(e.target.value)}
                  className={`w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all ${getThemeClasses(themePref).ring}`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => closeRouteDialog('addAccount')}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-xl py-2.5 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addAccountLoading}
                  className={`flex-1 text-white rounded-xl py-2.5 text-xs font-semibold transition-all cursor-pointer ${getThemeClasses(themePref).primary} disabled:opacity-50`}
                >
                  {addAccountLoading ? "Signing in..." : "Link Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Dialog Modal */}
      {showSettingsDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div ref={settingsDialogRef} className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 flex flex-col md:flex-row gap-6 animate-in zoom-in-95 duration-200">
            
            {/* Sidebar Navigation (Left) */}
            <div className="w-full md:w-48 shrink-0 flex flex-row md:flex-col gap-1 border-b md:border-b-0 md:border-r border-slate-250/60 dark:border-slate-800 pb-3 md:pb-0 md:pr-4 overflow-x-auto md:overflow-x-visible">
              {[
                { id: 'appearance', label: '🎨 Appearance' },
                { id: 'notifications', label: '🔔 Notifications' },
                { id: 'security', label: '🔒 Security' },
                { id: 'privacy', label: '🛡️ Privacy' },
                { id: 'memory', label: '🧠 AI Memory' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSettingsTab(tab.id as any)}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl text-left cursor-pointer transition-all shrink-0 ${
                    activeSettingsTab === tab.id
                      ? 'bg-indigo-650/10 text-indigo-650 dark:bg-indigo-500/15 dark:text-indigo-400 font-bold'
                      : 'text-slate-655 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content Panel (Right) */}
            <div className="flex-1 min-w-0 flex flex-col justify-between min-h-[360px]">
              <div className="space-y-4">
                
                {/* 1. APPEARANCE PANEL */}
                {activeSettingsTab === 'appearance' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-855 dark:text-white border-b border-slate-100 dark:border-slate-850 pb-2">Appearance & Language</h4>
                    
                    {/* Theme Accents */}
                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Color Accent Preference</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { id: 'indigo', name: 'Indigo', color: 'bg-indigo-650' },
                          { id: 'emerald', name: 'Emerald', color: 'bg-emerald-550' },
                          { id: 'amber', name: 'Amber', color: 'bg-amber-550' },
                          { id: 'slate', name: 'Slate', color: 'bg-slate-600' }
                        ].map((themeItem) => (
                          <button
                            key={themeItem.id}
                            type="button"
                            onClick={() => {
                              setThemePref(themeItem.id as any);
                              localStorage.setItem('mega_theme_pref', themeItem.id);
                            }}
                            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                              themePref === themeItem.id
                                ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800/80 shadow-sm'
                                : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full ${themeItem.color} shadow-sm`} />
                            <span className="text-[10px]">{themeItem.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Theme mode selectors */}
                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Interface mode</label>
                      <div className="flex gap-2">
                        {[
                          { id: 'light', name: '☀️ Light' },
                          { id: 'dark', name: '🌙 Dark' },
                          { id: 'system', name: '💻 System' }
                        ].map((modeItem) => (
                          <button
                            key={modeItem.id}
                            type="button"
                            onClick={() => setThemeMode(modeItem.id as any)}
                            className={`flex-1 border rounded-xl py-2 text-xs font-semibold cursor-pointer transition-all ${
                              themeMode === modeItem.id
                                ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800/85'
                                : 'border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            {modeItem.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Language selector */}
                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Application Language</label>
                      <select
                        value={languagePref}
                        onChange={(e) => {
                          setLanguagePref(e.target.value as any);
                          localStorage.setItem('mega_language_pref', e.target.value);
                        }}
                        className={`w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none transition-all ${getThemeClasses(themePref).ring}`}
                      >
                        <option value="en">English (US)</option>
                        <option value="es">Español (ES)</option>
                        <option value="fr">Français (FR)</option>
                        <option value="de">Deutsch (DE)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* 2. NOTIFICATIONS PREFERENCES */}
                {activeSettingsTab === 'notifications' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-855 dark:text-white border-b border-slate-100 dark:border-slate-850 pb-2">Notification Preferences</h4>
                    <p className="text-[11px] text-slate-400">Control when and where you receive notifications from Mega Assistant.</p>
                    
                    <div className="space-y-3 pt-2">
                      {[
                        { id: 'reminders', label: 'Reminders', desc: 'Notify when reminders are due, approaching soon, or overdue.', state: notifReminders, setter: setNotifReminders },
                        { id: 'tasks', label: 'Tasks', desc: 'Alerts when tasks are created, completed, updated, due soon, or overdue.', state: notifTasks, setter: setNotifTasks },
                        { id: 'automation', label: 'AI Automation', desc: 'Get updates on completed, failed, or scheduled workflow executions.', state: notifAutomation, setter: setNotifAutomation },
                        { id: 'docs_files', label: 'Documents & Files', desc: 'Alert when file uploads, processing, or document analyses complete.', state: notifDocsFiles, setter: setNotifDocsFiles },
                        { id: 'image_gen', label: 'Image Generation', desc: 'Notify when image generation runs complete or fail.', state: notifImageGen, setter: setNotifImageGen },
                        { id: 'background_ai', label: 'Background AI Tasks', desc: 'Get notified of long-running asynchronous AI operation statuses.', state: notifBackgroundAI, setter: setNotifBackgroundAI },
                        { id: 'account_security', label: 'Account & Security', desc: 'Security alerts, password updates, and account verification logs (Critical alerts bypass block).', state: notifAccountSecurity, setter: setNotifAccountSecurity },
                        { id: 'plan_billing', label: 'Plan & Billing', desc: 'Payment status, subscription changes, and invoicing updates.', state: notifPlanBilling, setter: setNotifPlanBilling },
                        { id: 'assistant_updates', label: 'Mega Assistant Updates', desc: 'Stay updated with product announcements, scheduled maintenance, and new features.', state: notifAssistantUpdates, setter: setNotifAssistantUpdates }
                      ].map((item) => (
                        <div key={item.id} className="flex items-start justify-between p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850/50 rounded-2xl gap-4">
                          <div className="min-w-0">
                            <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">{item.label}</span>
                            <span className="block text-[10px] text-slate-450 dark:text-slate-500 leading-snug mt-0.5">{item.desc}</span>
                          </div>
                          
                          {/* Toggle switch */}
                          <button
                            type="button"
                            onClick={() => handleTogglePref(item.id, item.state, item.setter)}
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 shrink-0 cursor-pointer ${
                              item.state ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
                              item.state ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. SECURITY PANEL */}
                {activeSettingsTab === 'security' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-855 dark:text-white border-b border-slate-100 dark:border-slate-850 pb-2">Security Settings</h4>
                    
                    {/* Password manager */}
                    <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850/50 p-4 rounded-2xl space-y-3">
                      <span className="block text-[9px] font-extrabold text-slate-455 dark:text-slate-400 uppercase tracking-widest">Update Account Password</span>
                      
                      {secError && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-455 text-[10px] p-2.5 rounded-xl">{secError}</div>}
                      {secSuccess && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-455 text-[10px] p-2.5 rounded-xl">{secSuccess}</div>}

                      {user?.google_linked ? (
                        <p className="text-[10px] text-slate-450">This account is logged in via Google OAuth. Direct password changes are unavailable.</p>
                      ) : (
                        <form onSubmit={handleSecurityPasswordChange} className="space-y-2.5">
                          <input
                            type="password"
                            required
                            placeholder="Current Password"
                            value={secCurrentPassword}
                            onChange={(e) => setSecCurrentPassword(e.target.value)}
                            className="w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <input
                            type="password"
                            required
                            placeholder="New Password"
                            value={secNewPassword}
                            onChange={(e) => setSecNewPassword(e.target.value)}
                            className="w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <input
                            type="password"
                            required
                            placeholder="Confirm New Password"
                            value={secConfirmPassword}
                            onChange={(e) => setSecConfirmPassword(e.target.value)}
                            className="w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <button
                            type="submit"
                            disabled={secLoading}
                            className={`w-full text-white text-xs font-bold py-2 rounded-xl transition-all cursor-pointer ${getThemeClasses(themePref).primary} disabled:opacity-50`}
                          >
                            {secLoading ? "Updating..." : "Update Password"}
                          </button>
                        </form>
                      )}
                    </div>

                    {/* Active login sessions (Mocked) */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="block text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Active Device Sessions</span>
                        <button
                          type="button"
                          onClick={() => alert("All other active device sessions have been logged out.")}
                          className="text-[9px] font-bold text-rose-500 hover:underline cursor-pointer bg-transparent"
                        >
                          Log out others
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] p-2 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-150/40 dark:border-slate-800">
                          <div>
                            <span className="font-bold block text-slate-800 dark:text-slate-200">Chrome Browser (Windows 11)</span>
                            <span className="text-slate-400 block text-[9px] mt-0.5">IP: 192.168.1.18 • Active now</span>
                          </div>
                          <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full uppercase">Current</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] p-2 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-150/40 dark:border-slate-800">
                          <div>
                            <span className="font-bold block text-slate-800 dark:text-slate-200">Mobile Safari (Apple iPhone)</span>
                            <span className="text-slate-400 block text-[9px] mt-0.5">IP: 172.56.21.144 • 3 hours ago</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2FA Coming Soon Badge */}
                    <div className="p-3 border border-dashed border-slate-250 dark:border-slate-800 rounded-2xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200">Two-Factor Authentication (2FA)</span>
                        <span className="block text-[9px] text-slate-400 mt-0.5">Secure your profile login attempts via authenticator codes.</span>
                      </div>
                      <span className="bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border border-indigo-500/20">Coming Soon</span>
                    </div>
                  </div>
                )}

                {/* 4. PRIVACY PANEL */}
                {activeSettingsTab === 'privacy' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-855 dark:text-white border-b border-slate-100 dark:border-slate-850 pb-2">Privacy & Actions</h4>
                    
                    <div className="space-y-3 text-xs">
                      {/* Export My Data */}
                      <div className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850/50 rounded-2xl">
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">Export My Data</span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">Download your profile data and tasks in JSON format.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ user, accounts, notes, tasks, reminders }, null, 2));
                            const downloadAnchor = document.createElement('a');
                            downloadAnchor.setAttribute("href", dataStr);
                            downloadAnchor.setAttribute("download", `mega_profile_export_${user?.id}.json`);
                            document.body.appendChild(downloadAnchor);
                            downloadAnchor.click();
                            downloadAnchor.remove();
                          }}
                          className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold px-3 py-1.5 rounded-xl cursor-pointer"
                        >
                          Export
                        </button>
                      </div>

                      {/* Download Chat History */}
                      <div className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850/50 rounded-2xl">
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">Download Chat History</span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">Backup all conversations on this system.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const chatData = JSON.stringify(sessions, null, 2);
                            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(chatData);
                            const downloadAnchor = document.createElement('a');
                            downloadAnchor.setAttribute("href", dataStr);
                            downloadAnchor.setAttribute("download", `mega_chat_history_${user?.id}.json`);
                            document.body.appendChild(downloadAnchor);
                            downloadAnchor.click();
                            downloadAnchor.remove();
                          }}
                          className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold px-3 py-1.5 rounded-xl cursor-pointer"
                        >
                          Download
                        </button>
                      </div>

                      {/* Clear Conversation Logs */}
                      <div className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850/50 rounded-2xl">
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">Clear Chat History</span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">Removes all active chats. Irreversible!</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Are you sure you want to delete your entire chat logs?")) {
                              setSessions([]);
                              setActiveSessionId('');
                              alert("Conversation history cleared.");
                            }
                          }}
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold px-3 py-1.5 rounded-xl cursor-pointer"
                        >
                          Clear Logs
                        </button>
                      </div>

                      {/* Privacy Policy Link */}
                      <div className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850/50 rounded-2xl">
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">Privacy Policy</span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">Read our terms of security and memory usage policies.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => alert("Privacy Policy: All memories and settings are processed locally and securely stored within your workspace user.json database.")}
                          className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer bg-transparent"
                        >
                          Read Policy
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. AI MEMORY PANEL */}
                {activeSettingsTab === 'memory' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2">
                      <h4 className="text-sm font-bold text-slate-855 dark:text-white">AI Memory manager</h4>
                      {memories.length > 0 && (
                        <button
                          onClick={handleClearAllMemories}
                          className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer bg-transparent"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    
                    {/* Save Memory manual form */}
                    <form onSubmit={handleSaveMemory} className="flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Add a fact to remember..."
                        value={newMemoryContent}
                        onChange={(e) => setNewMemoryContent(e.target.value)}
                        className={`flex-1 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-1.5 text-xs outline-none transition-all ${getThemeClasses(themePref).ring}`}
                      />
                      <button
                        type="submit"
                        className={`text-white px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0 ${getThemeClasses(themePref).primary}`}
                      >
                        Add
                      </button>
                    </form>

                    {/* List of saved memories */}
                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-slate-100 dark:border-slate-800/60 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-950/20">
                      {memories.length === 0 ? (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center py-6">No saved memories found. Say "remember..." in chat or type one above.</p>
                      ) : (
                        memories.map((mem) => (
                          <div
                            key={mem.id}
                            className="flex justify-between items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800/60 shadow-sm"
                          >
                            <span className="text-[10px] font-medium text-slate-700 dark:text-slate-200 leading-snug break-words flex-1">
                              {mem.content}
                            </span>
                            <button
                              onClick={() => handleDeleteMemory(mem.id)}
                              title="Delete memory"
                              className="text-[9px] font-semibold text-rose-500 hover:text-rose-600 cursor-pointer p-0.5"
                            >
                              Delete
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* Action Buttons (Footer) */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-850 mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowSettingsDialog(false)}
                  className={`w-full text-white rounded-xl py-2.5 text-xs font-semibold transition-all cursor-pointer ${getThemeClasses(themePref).primary}`}
                >
                  Close Settings
                </button>
              </div>

            </div>

          </div>
        </div>
      )}
      {/* Share Chat Modal */}
      {sharingSession && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="absolute inset-0" onClick={() => setSharingSession(null)} />
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl p-6 w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-250">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-4">
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-wide uppercase">
                Share Chat
              </h3>
              <button
                type="button"
                onClick={() => setSharingSession(null)}
                className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-250 p-1 rounded-lg cursor-pointer transition-colors"
                title="Close"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Choose how you want to share <strong className="text-slate-700 dark:text-slate-200">"{sharingSession.title}"</strong>:
              </p>
              
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/share/${sharingSession.id}`;
                    navigator.clipboard.writeText(shareUrl)
                      .then(() => {
                        setAuthSuccess("Share link copied to clipboard!");
                        setTimeout(() => setAuthSuccess(null), 2500);
                        setSharingSession(null);
                      })
                      .catch((err) => {
                        console.error("Failed to copy link:", err);
                        alert(`Failed to copy link automatically. Here is the link:\n${shareUrl}`);
                      });
                  }}
                  className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    📋 Copy share link
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Copy
                  </span>
                </button>
                
                {navigator.share && (
                  <button
                    type="button"
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/share/${sharingSession.id}`;
                      navigator.share({
                        title: sharingSession.title,
                        text: `Check out my chat on Mega Assistant: "${sharingSession.title}"`,
                        url: shareUrl
                      })
                        .then(() => {
                          setSharingSession(null);
                        })
                        .catch((err) => {
                          if (err.name !== 'AbortError') {
                            console.error("Web Share failed:", err);
                          }
                        });
                    }}
                    className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      📲 Share via system...
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Open
                    </span>
                  </button>
                )}
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 mt-4">
              <button
                type="button"
                onClick={() => setSharingSession(null)}
                className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-250 rounded-xl py-2.5 text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Conversation Confirmation Modal */}
      {deleteConfirmSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div
            ref={deleteConfirmDialogRef}
            className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200"
          >
            <div className="text-center md:text-left">
              <h3 className="text-base font-bold text-slate-850 dark:text-slate-100">
                Delete conversation?
              </h3>
              <p className="text-xs text-slate-455 dark:text-slate-400 mt-2 leading-relaxed">
                Are you sure you want to delete this conversation?
              </p>
              <p className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider mt-1.5">
                This action cannot be undone.
              </p>
            </div>
            
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmSessionId(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-xl py-2.5 text-xs font-semibold cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteSession}
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white rounded-xl py-2.5 text-xs font-semibold cursor-pointer transition-all active:scale-95 shadow-md shadow-rose-500/10"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden developer status metadata */}
      <div style={{ display: 'none' }} data-status={backendStatus} data-latency={latency} />
    </div>
  );
}
