"use client";

import { useState, useRef, useEffect } from "react";
import { useSupportTickets, useReplyToTicket, useResolveTicket, SupportTicket } from "@/hooks/useSupport";
import { Send, Loader2, LifeBuoy, CheckCircle2, MessageSquare, AlertCircle, Clock, ShieldCheck, XCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// UI Components
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SupportPage() {
  const [status, setStatus] = useState("OPEN");
  const { data: tickets, isLoading } = useSupportTickets(1, 50, status);
  const { mutate: sendReply, isPending: isReplying } = useReplyToTicket();
  const { mutate: resolveTicket, isPending: isResolving } = useResolveTicket();

  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTicket?.messages]);

  // If selected ticket updates from polling, refresh local state
  useEffect(() => {
    if (selectedTicket && tickets) {
      const updated = tickets.find(t => t._id === selectedTicket._id);
      if (updated) setSelectedTicket(updated);
    }
  }, [tickets]);

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;

    sendReply({ id: selectedTicket._id, message: replyMessage }, {
      onSuccess: () => {
        setReplyMessage("");
      }
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'text-red-700 bg-red-100 border-red-200 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/20';
      case 'HIGH': return 'text-amber-700 bg-amber-100 border-amber-200 dark:text-orange-400 dark:bg-orange-500/10 dark:border-orange-500/20';
      case 'LOW': return 'text-emerald-700 bg-emerald-100 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20';
      default: return 'text-blue-700 bg-blue-100 border-blue-200 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/20';
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-50 dark:bg-[#0a0a0a] animate-in fade-in duration-300">
      {/* LEFT PANE: Ticket Queue */}
      <div className="w-1/3 min-w-[380px] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col z-10 shadow-sm">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <LifeBuoy className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            Helpdesk
          </h1>
          
          <div className="flex bg-slate-100 dark:bg-slate-950 rounded-lg p-1 border border-slate-200 dark:border-slate-800 mb-2">
            {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map(s => (
              <button
                key={s}
                onClick={() => { setStatus(s); setSelectedTicket(null); }}
                className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
                  status === s ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {isLoading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
              <p className="text-sm font-medium text-muted-foreground">Loading queue...</p>
            </div>
          ) : tickets?.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-bold">Inbox Zero!</p>
              <p className="text-xs font-medium text-slate-500 mt-1">No {status.replace('_', ' ')} tickets.</p>
            </div>
          ) : (
            tickets?.map((ticket) => (
              <button
                key={ticket._id}
                onClick={() => setSelectedTicket(ticket)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedTicket?._id === ticket._id 
                    ? 'bg-blue-50 dark:bg-indigo-900/10 border-blue-200 dark:border-indigo-900/30 shadow-sm' 
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-mono font-medium text-slate-500">{ticket.ticketId}</span>
                  <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                </div>
                <h3 className={`font-bold mb-1.5 truncate ${selectedTicket?._id === ticket._id ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>
                  {ticket.subject}
                </h3>
                <div className="flex justify-between items-center text-xs font-medium text-slate-500">
                  <span className="truncate">{ticket.userId.fullName || ticket.userId.phone}</span>
                  <span className="whitespace-nowrap ml-2 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: false })}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANE: Chat Interface */}
      <div className="flex-1 bg-slate-50 dark:bg-[#0a0a0a] flex flex-col relative">
        {selectedTicket ? (
          <>
            {/* Chat Header */}
            <div className="h-[88px] border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {selectedTicket.subject}
                  <span className="text-xs font-mono text-muted-foreground font-medium ml-2 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">{selectedTicket.ticketId}</span>
                </h2>
                <div className="text-sm font-medium text-slate-500 flex items-center gap-3 mt-1">
                  <span>Retailer: <span className="text-slate-700 dark:text-slate-300">{selectedTicket.userId.fullName || selectedTicket.userId.name} ({selectedTicket.userId.phone})</span></span>
                  {selectedTicket.transactionId && (
                    <span className="flex items-center gap-1 text-primary bg-primary/5 px-2 py-0.5 rounded font-mono text-xs">
                      <AlertCircle className="w-3 h-3" /> TXN: {selectedTicket.transactionId.transactionId}
                    </span>
                  )}
                </div>
              </div>
              
              {['OPEN', 'IN_PROGRESS'].includes(selectedTicket.status) && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => resolveTicket({ id: selectedTicket._id, status: 'RESOLVED' })}
                    disabled={isResolving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Resolve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => resolveTicket({ id: selectedTicket._id, status: 'CLOSED' })}
                    disabled={isResolving}
                  >
                    <XCircle className="w-4 h-4 mr-2 text-slate-500" /> Close
                  </Button>
                </div>
              )}
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth bg-[url('/chat-bg-light.svg')] dark:bg-[url('/chat-bg-pattern.svg')] bg-repeat custom-scrollbar">
              {selectedTicket.messages.map((msg, idx) => {
                const isRetailer = msg.senderType === 'RETAILER';
                const isSystem = msg.senderType === 'SYSTEM';

                if (isSystem) {
                  return (
                    <div key={idx} className="flex justify-center my-6">
                      <span className="bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-500 text-xs font-bold px-4 py-2 rounded-full flex items-center gap-2 shadow-sm backdrop-blur-sm">
                        <ShieldCheck className="w-4 h-4 text-primary" /> {msg.message}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={idx} className={`flex ${isRetailer ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-5 py-4 shadow-sm ${
                      isRetailer 
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-tl-sm border border-slate-200 dark:border-slate-700' 
                        : 'bg-primary text-primary-foreground rounded-tr-sm'
                    }`}>
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap font-medium">{msg.message}</p>
                      <div className={`text-[10px] font-bold mt-2 flex items-center justify-end gap-1 ${isRetailer ? 'text-slate-400' : 'text-primary-foreground/70'}`}>
                        {format(new Date(msg.createdAt), 'hh:mm a')}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            {['OPEN', 'IN_PROGRESS'].includes(selectedTicket.status) ? (
              <form onSubmit={handleSendReply} className="shrink-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
                <Input
                  type="text"
                  placeholder="Type a reply to the retailer..."
                  className="flex-1 rounded-full px-6 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-12"
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!replyMessage.trim() || isReplying}
                  className="w-12 h-12 shrink-0 rounded-full shadow-md"
                >
                  {isReplying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-1" />}
                </Button>
              </form>
            ) : (
              <div className="shrink-0 p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-center font-bold text-slate-500 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" /> This ticket is marked as {selectedTicket.status}. Replies are disabled.
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center mb-6">
              <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-700" />
            </div>
            <p className="text-xl font-bold text-slate-700 dark:text-slate-300">No conversation selected</p>
            <p className="text-sm font-medium mt-1">Select a ticket from the queue to view chat history.</p>
          </div>
        )}
      </div>
    </div>
  );
}
