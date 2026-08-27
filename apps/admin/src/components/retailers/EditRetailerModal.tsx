'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUpdateRetailerProfile } from '@/hooks/useRetailers';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EditRetailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  retailer: {
    _id: string;
    name: string;
    phone: string;
    email?: string;
    shopName?: string;
    city?: string;
    state?: string;
    accountType?: 'PERSONAL' | 'BUSINESS';
  } | null;
}

export function EditRetailerModal({ isOpen, onClose, retailer }: EditRetailerModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [shopName, setShopName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [accountType, setAccountType] = useState<'PERSONAL' | 'BUSINESS'>('PERSONAL');

  const updateProfileMutation = useUpdateRetailerProfile();

  useEffect(() => {
    if (retailer) {
      setName(retailer.name || '');
      setPhone(retailer.phone || '');
      setEmail(retailer.email || '');
      setShopName(retailer.shopName || '');
      setCity(retailer.city || '');
      setState(retailer.state || '');
      setAccountType(retailer.accountType || 'PERSONAL');
    }
  }, [retailer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retailer) return;

    if (!name.trim() || !phone.trim()) {
      toast.error('Name and Phone number are required.');
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        id: retailer._id,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        shopName: shopName.trim(),
        city: city.trim(),
        state: state.trim(),
        accountType,
      });

      toast.success('Retailer profile updated successfully.');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update profile');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
            Edit Retailer Profile
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Full Name *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Retailer Name"
                className="h-10 rounded-xl"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Phone Number *
              </label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                className="h-10 rounded-xl"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Email Address
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@domain.com"
                className="h-10 rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Account Type
              </label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as 'PERSONAL' | 'BUSINESS')}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="PERSONAL">PERSONAL</option>
                <option value="BUSINESS">BUSINESS</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Shop / Business Name
            </label>
            <Input
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Shop or Business Name"
              className="h-10 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                City / District
              </label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="h-10 rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                State
              </label>
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State"
                className="h-10 rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="pt-4 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl h-11"
              disabled={updateProfileMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 font-bold"
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
