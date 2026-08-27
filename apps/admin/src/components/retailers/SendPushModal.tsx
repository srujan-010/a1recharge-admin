'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useSendPushNotification } from '@/hooks/useRetailers';
import { Loader2, Bell } from 'lucide-react';
import { toast } from 'sonner';

interface SendPushModalProps {
  isOpen: boolean;
  onClose: () => void;
  retailer: {
    _id: string;
    name: string;
    phone: string;
    fcmToken?: string | null;
  } | null;
}

export function SendPushModal({ isOpen, onClose, retailer }: SendPushModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const sendPushMutation = useSendPushNotification();

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retailer) return;

    if (!title.trim() || !body.trim()) {
      toast.error('Notification title and message body are required.');
      return;
    }

    try {
      await sendPushMutation.mutateAsync({
        recipients: [retailer._id],
        title: title.trim(),
        body: body.trim(),
      });

      toast.success(`Push notification sent to ${retailer.name}.`);
      setTitle('');
      setBody('');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to send push notification');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-indigo-500" />
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
              Send Push Notification
            </DialogTitle>
          </div>
          <p className="text-xs text-slate-500">
            Recipient: <span className="font-bold text-slate-700 dark:text-slate-300">{retailer?.name}</span> ({retailer?.phone})
          </p>
        </DialogHeader>

        <form onSubmit={handleSend} className="space-y-4 py-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Title *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notification Title (e.g. Special Offer / Update)"
              className="h-10 rounded-xl"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Message Body *
            </label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter push notification message content..."
              className="min-h-[100px] rounded-xl resize-none"
              required
            />
          </div>

          <DialogFooter className="pt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl h-11"
              disabled={sendPushMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 font-bold"
              disabled={sendPushMutation.isPending}
            >
              {sendPushMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send Push
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
