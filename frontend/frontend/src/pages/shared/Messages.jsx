import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  MessageSquare, Send, Paperclip, Inbox, ArrowLeft, X,
  FileText, CheckCircle2, AlertCircle, Pencil, Search,
  MoreHorizontal, ChevronDown, Clock, User, Globe
} from 'lucide-react';
import { apiGet, apiPost, apiPut } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function Avatar({ name, size = 'md', color }) {
  const colors = [
    'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
    'bg-orange-500', 'bg-rose-500', 'bg-cyan-500', 'bg-amber-500'
  ];
  const bg = color || colors[(name?.charCodeAt(0) || 0) % colors.length];
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-11 h-11 text-sm' : 'w-9 h-9 text-xs';
  return (
    <div className={`${sz} ${bg} rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0 shadow-sm`}>
      {getInitials(name)}
    </div>
  );
}

function Alert({ msg, onClose }) {
  if (!msg.text) return null;
  const isSuccess = msg.type === 'success';
  return (
    <div className={`flex items-start gap-3 px-5 py-4 rounded-2xl border text-sm font-medium animate-in slide-in-from-top-1 duration-200 ${
      isSuccess
        ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
        : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
    }`}>
      {isSuccess ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
      <span className="flex-1">{msg.text}</span>
      <button onClick={onClose} className="hover:opacity-60 transition-opacity"><X className="w-4 h-4" /></button>
    </div>
  );
}

function FileChip({ file, onRemove }) {
  return (
    <div className="flex items-center gap-2 bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-700 dark:text-neutral-300 max-w-[180px]">
      <FileText className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
      <span className="truncate">{file.name}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} className="hover:text-red-500 transition-colors flex-shrink-0">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export default function Messages() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('inbox');
  const [messages, setMessages] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [thread, setThread] = useState(null);
  const [users, setUsers] = useState([]);
  const [compose, setCompose] = useState({ to: '', subject: '', body: '', files: [] });
  const [reply, setReply] = useState({ body: '', files: [] });
  const [loading, setLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [showCompose, setShowCompose] = useState(false);
  const fileInputRef = useRef(null);
  const replyFileRef = useRef(null);
  const messagesEndRef = useRef(null);
  const unreadCount = messages.filter(m => m && (m.is_read === false || m.is_read === 0)).length;
  const websiteUnreadCount = inquiries.filter(i => i.is_read === false || i.is_read === 0).length;

  const filteredMessages = messages.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (m.other_name || m.sender_name || '').toLowerCase().includes(q) ||
      (m.subject || '').toLowerCase().includes(q) ||
      (m.body || '').toLowerCase().includes(q)
    );
  });

  const filteredInquiries = inquiries.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (item.name || '').toLowerCase().includes(q) ||
      (item.email || '').toLowerCase().includes(q) ||
      (item.subject || '').toLowerCase().includes(q) ||
      (item.body || '').toLowerCase().includes(q)
    );
  });

  const loadMessages = async () => {
    setLoading(true);
    try {
      const data = await apiGet(`/api/messages?tab=${tab}`);
      setMessages(data.messages || []);
    } catch (e) {
      setMsg({ type: 'error', text: 'Failed to load messages' });
    } finally { setLoading(false); }
  };

  const loadContactInquiries = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const data = await apiGet('/api/contact/inquiries');
      setInquiries(data.inquiries || []);
    } catch (e) {
      setMsg({ type: 'error', text: 'Failed to load website contact messages' });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await apiGet('/api/users/list');
      setUsers(data.users || []);
    } catch (e) { console.error('Failed to load users', e); }
  };

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab === 'website' && isAdmin) setTab('website');
    else if (requestedTab === 'sent') setTab('sent');
    else if (requestedTab === 'inbox') setTab('inbox');
  }, [searchParams, isAdmin]);

  useEffect(() => {
    if (tab === 'website') loadContactInquiries();
    else loadMessages();
  }, [tab, isAdmin]);

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => {
    if (thread?.thread) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  const loadThread = async (m) => {
    setSelectedInquiry(null);
    setSelected(m); setThread(null); setShowCompose(false); setThreadLoading(true);
    try {
      const data = await apiGet(`/api/messages/${m.id}`);
      setThread(data);
      if (data?.message?.recipient_id === user?.id) {
        await fetch(`${API_BASE}/api/messages/${m.id}/read`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        window.dispatchEvent(new Event('app:notifications-changed'));
      }
    } catch (e) {
      setMsg({ type: 'error', text: 'Failed to load message' });
    } finally { setThreadLoading(false); }
  };

  const loadContactInquiry = async (inquiry) => {
    setSelected(null);
    setThread(null);
    setShowCompose(false);
    setSelectedInquiry(inquiry);

    if (inquiry.is_read === false || inquiry.is_read === 0) {
      try {
        await apiPut(`/api/contact/inquiries/${inquiry.id}/read`, {});
        loadContactInquiries();
      } catch (e) {
        console.error('Failed to mark inquiry read', e);
      }
    }
  };

  const handleSendNew = async (e) => {
    e.preventDefault();
    if (!compose.to || !compose.body?.trim()) {
      setMsg({ type: 'error', text: 'Select a recipient and enter a message' }); return;
    }
    setLoading(true); setMsg({ type: '', text: '' });
    try {
      const token = localStorage.getItem('token');
      if (compose.files.length > 0) {
        const fd = new FormData();
        fd.append('recipient_id', compose.to);
        fd.append('subject', compose.subject);
        fd.append('body', compose.body);
        compose.files.forEach(f => fd.append('attachments', f));
        const r = await fetch(`${API_BASE}/api/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
        const data = await r.json();
        if (data.error) throw new Error(data.error);
      } else {
        await apiPost('/api/messages', { recipient_id: parseInt(compose.to), subject: compose.subject, body: compose.body });
      }
      setCompose({ to: '', subject: '', body: '', files: [] });
      setMsg({ type: 'success', text: 'Message sent successfully' });
      setShowCompose(false);
      loadMessages();
      window.dispatchEvent(new Event('app:notifications-changed'));
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Failed to send' });
    } finally { setLoading(false); }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!reply.body?.trim()) { setMsg({ type: 'error', text: 'Enter a reply' }); return; }
    if (!thread?.message) return;
    setLoading(true); setMsg({ type: '', text: '' });
    try {
      const otherId = thread.message.sender_id === user?.id ? thread.message.recipient_id : thread.message.sender_id;
      const rootId = thread.message.parent_id || thread.message.id;
      const token = localStorage.getItem('token');
      if (reply.files.length > 0) {
        const fd = new FormData();
        fd.append('recipient_id', otherId); fd.append('parent_id', rootId); fd.append('body', reply.body);
        reply.files.forEach(f => fd.append('attachments', f));
        const r = await fetch(`${API_BASE}/api/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
        const data = await r.json();
        if (data.error) throw new Error(data.error);
      } else {
        await apiPost('/api/messages', { recipient_id: otherId, parent_id: rootId, body: reply.body });
      }
      setReply({ body: '', files: [] });
      setMsg({ type: 'success', text: 'Reply sent' });
      loadThread(selected); loadMessages();
      window.dispatchEvent(new Event('app:notifications-changed'));
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Failed to reply' });
    } finally { setLoading(false); }
  };

  const downloadAttachment = async (att) => {
    const token = localStorage.getItem('token');
    const r = await fetch(`${API_BASE}/api/messages/attachments/${att.id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = att.file_name || 'attachment'; a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (d) => {
    const date = new Date(d); const now = new Date(); const diff = now - date;
    const days = Math.floor(diff / 86400000);
    if (days === 0) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    if (days < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatFullDate = (d) => new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  });

  const otherName = thread?.message
    ? (thread.message.sender_id === user?.id ? thread.message.recipient_name : thread.message.sender_name)
    : selected?.other_name || selected?.sender_name || '';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 space-y-6">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-neutral-500 mb-1">Communication</p>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Messages</h1>
          </div>
          <Button
            onClick={() => { setShowCompose(true); setSelected(null); setThread(null); setReply({ body: '', files: [] }); }}
            className="h-10 px-5 rounded-xl gap-2 bg-gray-900 hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-white font-semibold shadow-md transition-all text-sm"
          >
            <Pencil className="w-3.5 h-3.5" /> New Message
          </Button>
        </div>

        <Alert msg={msg} onClose={() => setMsg({ type: '', text: '' })} />

        {/* ── Three-pane layout ── */}
        <div className="flex gap-5 h-[calc(100vh-220px)] min-h-[560px]">

          {/* ── Sidebar: inbox/sent list ── */}
          <div className="w-80 flex-shrink-0 flex flex-col bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm overflow-hidden">

            {/* Tabs */}
            <div className="p-3 border-b border-gray-100 dark:border-neutral-800 flex gap-1.5 flex-wrap">
              {[
                { id: 'inbox', label: 'Inbox', icon: Inbox },
                { id: 'sent', label: 'Sent', icon: Send },
                ...(isAdmin ? [{ id: 'website', label: 'Website', icon: Globe }] : []),
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => {
                    setTab(id);
                    setSelected(null);
                    setSelectedInquiry(null);
                    setThread(null);
                    setShowCompose(false);
                  }}
                  className={`flex-1 min-w-[88px] flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    tab === id
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                      : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {id === 'inbox' && unreadCount > 0 && (
                    <span className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold ${
                      tab === 'inbox' ? 'bg-white/20 text-white dark:bg-gray-900/20 dark:text-gray-900' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    }`}>
                      {unreadCount}
                    </span>
                  )}
                  {id === 'website' && websiteUnreadCount > 0 && (
                    <span className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold ${
                      tab === 'website' ? 'bg-white/20 text-white dark:bg-gray-900/20 dark:text-gray-900' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                    }`}>
                      {websiteUnreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="px-3 py-2.5 border-b border-gray-100 dark:border-neutral-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search messages…"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/20 dark:focus:ring-white/20 placeholder:text-gray-400 dark:placeholder:text-neutral-600 text-gray-700 dark:text-neutral-300 transition-all"
                />
              </div>
            </div>

            {/* Message list */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-7 h-7 border-2 border-gray-200 dark:border-neutral-700 border-t-gray-900 dark:border-t-white rounded-full animate-spin" />
                  <p className="text-xs text-gray-400 dark:text-neutral-500">Loading…</p>
                </div>
              ) : tab === 'website' ? (
                filteredInquiries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
                      <Globe className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-neutral-300">
                        {search ? 'No results' : 'No website contact messages'}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
                        Messages from the public Contact Us form will appear here
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-neutral-800/60">
                    {filteredInquiries.map((item) => {
                      const isUnread = item.is_read === false || item.is_read === 0;
                      const isActive = selectedInquiry?.id === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => loadContactInquiry(item)}
                          className={`w-full text-left px-4 py-3.5 transition-all duration-150 ${
                            isActive
                              ? 'bg-gray-900 dark:bg-white'
                              : 'hover:bg-gray-50 dark:hover:bg-neutral-800/60'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <Avatar name={item.name} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <span className={`text-xs font-bold truncate ${
                                  isActive ? 'text-white dark:text-gray-900' : 'text-gray-900 dark:text-white'
                                }`}>
                                  {item.name}
                                </span>
                                <span className={`text-[10px] flex-shrink-0 ${
                                  isActive ? 'text-gray-300 dark:text-gray-500' : 'text-gray-400 dark:text-neutral-500'
                                }`}>
                                  {formatDate(item.created_at)}
                                </span>
                              </div>
                              <p className={`text-[11px] font-semibold truncate mb-0.5 ${
                                isActive ? 'text-gray-200 dark:text-gray-700' : isUnread ? 'text-gray-800 dark:text-neutral-200' : 'text-gray-600 dark:text-neutral-400'
                              }`}>
                                {item.subject}
                              </p>
                              <div className="flex items-center gap-2">
                                {isUnread && <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                                <p className={`text-[11px] truncate leading-relaxed ${
                                  isActive ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400 dark:text-neutral-500'
                                }`}>
                                  {item.body?.slice(0, 55)}{item.body?.length > 55 ? '…' : ''}
                                </p>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
                    <Inbox className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-neutral-300">
                      {search ? 'No results' : `No ${tab} messages`}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
                      {search ? 'Try a different search' : 'Messages will appear here'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-neutral-800/60">
                  {filteredMessages.map((m) => {
                    const isUnread = tab === 'inbox' && (m.is_read === false || m.is_read === 0);
                    const isActive = selected?.id === m.id;
                    const name = m.other_name || m.sender_name || '?';
                    return (
                      <button
                        key={m.id}
                        onClick={() => loadThread(m)}
                        className={`w-full text-left px-4 py-3.5 transition-all duration-150 ${
                          isActive
                            ? 'bg-gray-900 dark:bg-white'
                            : 'hover:bg-gray-50 dark:hover:bg-neutral-800/60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar name={name} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className={`text-xs font-bold truncate ${
                                isActive ? 'text-white dark:text-gray-900' : 'text-gray-900 dark:text-white'
                              }`}>
                                {name}
                              </span>
                              <span className={`text-[10px] flex-shrink-0 ${
                                isActive ? 'text-gray-300 dark:text-gray-500' : 'text-gray-400 dark:text-neutral-500'
                              }`}>
                                {formatDate(m.created_at)}
                              </span>
                            </div>
                            {m.subject && (
                              <p className={`text-[11px] font-semibold truncate mb-0.5 ${
                                isActive ? 'text-gray-200 dark:text-gray-700' : isUnread ? 'text-gray-800 dark:text-neutral-200' : 'text-gray-600 dark:text-neutral-400'
                              }`}>
                                {m.subject}
                              </p>
                            )}
                            <div className="flex items-center gap-2">
                              {isUnread && (
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                              )}
                              <p className={`text-[11px] truncate leading-relaxed ${
                                isActive ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400 dark:text-neutral-500'
                              }`}>
                                {m.body?.slice(0, 55)}{m.body?.length > 55 ? '…' : ''}
                              </p>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Main pane ── */}
          <div className="flex-1 min-w-0 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm overflow-hidden flex flex-col">

            {/* ── Compose view ── */}
            {showCompose && !selected && (
              <>
                <div className="px-7 py-5 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl bg-gray-900 dark:bg-white flex items-center justify-center shadow-md flex-shrink-0">
                    <Pencil className="w-4 h-4 text-white dark:text-gray-900" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">New Message</h2>
                    <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">Send a direct message to a team member</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-7 py-6">
                  <form onSubmit={handleSendNew} className="space-y-5 max-w-2xl">

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-neutral-500 mb-2">To</label>
                      <select
                        value={compose.to}
                        onChange={e => setCompose({ ...compose, to: e.target.value })}
                        className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm text-gray-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-gray-900/20 dark:focus:ring-white/20 focus:border-transparent transition-all"
                      >
                        <option value="">Select recipient…</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-neutral-500 mb-2">Subject <span className="normal-case font-normal">(optional)</span></label>
                      <input
                        value={compose.subject}
                        onChange={e => setCompose({ ...compose, subject: e.target.value })}
                        placeholder="What's this about?"
                        className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm text-gray-800 dark:text-neutral-200 placeholder:text-gray-400 dark:placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-gray-900/20 dark:focus:ring-white/20 focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-neutral-500 mb-2">Message</label>
                      <textarea
                        value={compose.body}
                        onChange={e => setCompose({ ...compose, body: e.target.value })}
                        rows={8}
                        placeholder="Write your message…"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm text-gray-800 dark:text-neutral-200 placeholder:text-gray-400 dark:placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-gray-900/20 dark:focus:ring-white/20 focus:border-transparent resize-none transition-all leading-relaxed"
                      />
                    </div>

                    {/* Attachments */}
                    <div>
                      <input type="file" ref={fileInputRef} multiple className="hidden" onChange={e => {
                        setCompose(c => ({ ...c, files: [...c.files, ...Array.from(e.target.files || [])] }));
                      }} />
                      {compose.files.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {compose.files.map((f, i) => (
                            <FileChip key={i} file={f} onRemove={() => setCompose(c => ({ ...c, files: c.files.filter((_, idx) => idx !== i) }))} />
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors border border-dashed border-gray-300 dark:border-neutral-700 rounded-xl px-4 py-2.5 hover:border-gray-400 dark:hover:border-neutral-500"
                      >
                        <Paperclip className="w-3.5 h-3.5" /> Attach files
                      </button>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <Button
                        type="submit"
                        disabled={loading}
                        className="h-11 px-6 rounded-xl gap-2 bg-gray-900 hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-white font-semibold shadow-md transition-all disabled:opacity-40 text-sm"
                      >
                        {loading
                          ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending…</>
                          : <><Send className="w-4 h-4" /> Send Message</>}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setCompose({ to: '', subject: '', body: '', files: [] })}
                        className="h-11 px-4 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white text-sm"
                      >
                        Clear
                      </Button>
                    </div>
                  </form>
                </div>
              </>
            )}

            {/* ── Empty state (no compose, no selected) ── */}
            {!showCompose && !selected && !selectedInquiry && (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
                  <MessageSquare className="w-7 h-7 text-gray-400" />
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">Select a conversation</p>
                  <p className="text-sm text-gray-400 dark:text-neutral-500 mt-1">Choose a message from the list, or compose a new one</p>
                </div>
                <Button
                  onClick={() => setShowCompose(true)}
                  className="h-10 px-5 rounded-xl gap-2 bg-gray-900 hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-white font-semibold text-sm shadow-md"
                >
                  <Pencil className="w-3.5 h-3.5" /> Compose
                </Button>
              </div>
            )}

            {/* ── Website contact detail ── */}
            {selectedInquiry && (
              <>
                <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-4 flex-shrink-0">
                  <button
                    onClick={() => setSelectedInquiry(null)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-700 dark:hover:text-white transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <Avatar name={selectedInquiry.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{selectedInquiry.name}</p>
                    <p className="text-xs text-gray-400 dark:text-neutral-500 truncate mt-0.5">{selectedInquiry.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-neutral-500">
                    <Clock className="w-3.5 h-3.5" />
                    {formatFullDate(selectedInquiry.created_at)}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
                  <div className="rounded-2xl border border-red-100 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/20 p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-red-600 mb-1">Website Contact</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedInquiry.subject}</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-neutral-500 mb-1">From</p>
                      <p className="text-sm text-gray-800 dark:text-neutral-200">{selectedInquiry.name}</p>
                      <a href={`mailto:${selectedInquiry.email}`} className="text-sm text-red-600 hover:underline">{selectedInquiry.email}</a>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-neutral-500 mb-2">Message</p>
                      <div className="rounded-2xl border border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/60 p-5 text-sm text-gray-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
                        {selectedInquiry.body}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Thread view ── */}
            {selected && (
              <>
                {/* Thread header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-4 flex-shrink-0">
                  <button
                    onClick={() => { setSelected(null); setThread(null); setReply({ body: '', files: [] }); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-700 dark:hover:text-white transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  {otherName && <Avatar name={otherName} />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{otherName}</p>
                    {selected?.subject && (
                      <p className="text-xs text-gray-400 dark:text-neutral-500 truncate mt-0.5">{selected.subject}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-neutral-500">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDate(selected.created_at)}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                  {threadLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <div className="w-7 h-7 border-2 border-gray-200 dark:border-neutral-700 border-t-gray-900 dark:border-t-white rounded-full animate-spin" />
                      <p className="text-xs text-gray-400 dark:text-neutral-500">Loading conversation…</p>
                    </div>
                  ) : (
                    thread?.thread?.map((t) => {
                      const isMine = t.sender_id === user?.id;
                      return (
                        <div key={t.id} className={`flex gap-3 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                          <Avatar name={t.sender_name} size="sm" />
                          <div className={`max-w-[70%] space-y-1 ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-semibold text-gray-500 dark:text-neutral-400 ${isMine ? 'order-2' : ''}`}>
                                {t.sender_name}
                              </span>
                              <span className="text-[10px] text-gray-400 dark:text-neutral-500">
                                {formatFullDate(t.created_at)}
                              </span>
                            </div>
                            <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                              isMine
                                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-tr-md'
                                : 'bg-gray-100 dark:bg-neutral-800 text-gray-800 dark:text-neutral-200 rounded-tl-md'
                            }`}>
                              <p className="whitespace-pre-wrap">{t.body}</p>
                              {t.attachments?.length > 0 && (
                                <div className={`mt-3 pt-3 border-t flex flex-wrap gap-2 ${isMine ? 'border-white/20 dark:border-gray-900/20' : 'border-gray-200 dark:border-neutral-700'}`}>
                                  {t.attachments.map(a => (
                                    <button
                                      key={a.id}
                                      onClick={() => downloadAttachment(a)}
                                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                                        isMine
                                          ? 'bg-white/15 hover:bg-white/25 text-white dark:bg-gray-900/15 dark:hover:bg-gray-900/25 dark:text-gray-900'
                                          : 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                                      }`}
                                    >
                                      <Paperclip className="w-3 h-3" />
                                      {a.file_name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply box */}
                <div className="px-6 pb-5 pt-4 border-t border-gray-100 dark:border-neutral-800 flex-shrink-0">
                  <form onSubmit={handleReply}>
                    <div className="flex gap-3 items-end">
                      <div className="flex-1 min-w-0">
                        {reply.files.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {reply.files.map((f, i) => (
                              <FileChip key={i} file={f} onRemove={() => setReply(r => ({ ...r, files: r.files.filter((_, idx) => idx !== i) }))} />
                            ))}
                          </div>
                        )}
                        <div className="relative">
                          <textarea
                            value={reply.body}
                            onChange={e => setReply({ ...reply, body: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply(e); }}
                            rows={2}
                            placeholder="Write a reply… (⌘↵ to send)"
                            className="w-full px-4 py-3 pr-24 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm text-gray-800 dark:text-neutral-200 placeholder:text-gray-400 dark:placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-gray-900/20 dark:focus:ring-white/20 focus:border-transparent resize-none transition-all leading-relaxed"
                          />
                          <div className="absolute right-2 bottom-2 flex items-center gap-1">
                            <input type="file" ref={replyFileRef} multiple className="hidden" onChange={e => {
                              setReply(r => ({ ...r, files: [...r.files, ...Array.from(e.target.files || [])] }));
                            }} />
                            <button
                              type="button"
                              onClick={() => replyFileRef.current?.click()}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700 hover:text-gray-700 dark:hover:text-white transition-all"
                              title="Attach files"
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="submit"
                              disabled={loading || !reply.body.trim()}
                              className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-900 dark:bg-white text-white dark:text-gray-900 disabled:opacity-30 hover:bg-gray-700 dark:hover:bg-gray-100 transition-all shadow-sm disabled:shadow-none"
                              title="Send reply"
                            >
                              {loading
                                ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white dark:border-gray-900/30 dark:border-t-gray-900 rounded-full animate-spin" />
                                : <Send className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}