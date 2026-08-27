'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSendDirectSMS } from '@/hooks/useRetailers';
import { Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface SendSmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  retailer: {
    _id: string;
    name: string;
    phone: string;
  } | null;
}

export function SendSmsModal({ isOpen, onClose, retailer }: SendSmsModalProps) {
  const [message, setMessage] = useState('');
  const sendSmsMutation = useSendDirectSMS();

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retailer) return;

    if (!message.trim()) {
      toast.error('SMS message cannot be empty.');
      return;
    }

    try {
      await sendSmsMutation.mutateAsync({
        userId: retailer._id,
        phone: retailer.phone,
        message: message.trim(),
      });

      toast.success(`SMS sent successfully to ${retailer.phone}.`);
      setMessage('');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to send SMS');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-5 h-5 text-emerald-500" />
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
              Send Direct SMS
            </DialogTitle>
          </div>
          <p className="text-xs text-slate-500">
            To: <span className="font-bold text-slate-700 dark:text-slate-300">{retailer?.name}</span> ({retailer?.phone})
          </p>
        </DialogHeader>

        <form onSubmit={handleSend} className="space-y-4 py-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              SMS Message *
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your SMS message here..."
              className="min-h-[120px] rounded-xl resize-none"
              required
            />
            <div className="flex justify-between items-center mt-1.5 text-[11px] text-slate-400">
              <span>Fast2SMS Gateway Integration</span>
              <span>{message.length} chars ({Math.ceil(message.length / 160) || 1} SMS)</span>
            </div>
          </div>

          <DialogFooter className="pt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl h-11"
              disabled={sendSmsMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 font-bold"
              disabled={sendSmsMutation.isPending}
            >
              {sendSmsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send SMS
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
