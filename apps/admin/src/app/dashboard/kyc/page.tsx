"use client";

import { useState } from "react";
import { useKycList, useUpdateKycStatus, KycRecord } from "@/hooks/useKyc";
import { Loader2, UserCheck, Search, Image as ImageIcon, CheckCircle, XCircle, FileWarning } from "lucide-react";
import { format } from "date-fns";

// UI Components
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function KycPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("pending");

  const { data, isLoading } = useKycList(page, 20, search, status);
  const { mutate: updateKyc, isPending: isUpdating } = useUpdateKycStatus();

  const [selectedKyc, setSelectedKyc] = useState<KycRecord | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
    setSelectedKyc(null);
  };

  const handleApprove = () => {
    if (!selectedKyc) return;
    updateKyc(
      { id: selectedKyc._id, status: 'verified' },
      { onSuccess: () => setSelectedKyc(null) }
    );
  };

  const handleReject = () => {
    if (!selectedKyc) return;
    if (rejectReason.length < 5) {
      alert("Please enter a valid rejection reason.");
      return;
    }
    updateKyc(
      { id: selectedKyc._id, status: 'rejected', remarks: rejectReason },
      { onSuccess: () => {
          setSelectedKyc(null);
          setRejectReason("");
      }}
    );
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-50 dark:bg-[#0a0a0a]">
      {/* LEFT PANE: Master List */}
      <div className="w-1/3 min-w-[350px] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col z-10 shadow-sm">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-primary" />
            </div>
            KYC Verification
          </h1>
          
          <div className="space-y-4">
            <div className="flex bg-slate-100 dark:bg-slate-950 rounded-lg p-1 border border-slate-200 dark:border-slate-800">
              {['pending', 'verified', 'rejected'].map(s => (
                <button
                  key={s}
                  onClick={() => { setStatus(s); setPage(1); setSelectedKyc(null); }}
                  className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                    status === s ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search name or shop..."
                className="pl-9"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </form>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {isLoading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
              <p className="text-sm font-medium text-muted-foreground">Loading documents...</p>
            </div>
          ) : data?.data?.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <FileWarning className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500 font-medium">No {status} KYC records found.</p>
            </div>
          ) : (
            data?.data?.map((kyc) => (
              <button
                key={kyc._id}
                onClick={() => { setSelectedKyc(kyc); setRejectReason(""); }}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedKyc?._id === kyc._id 
                    ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30 shadow-sm' 
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <h3 className={`font-bold ${selectedKyc?._id === kyc._id ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>
                    {kyc.fullName || kyc.user?.phone}
                  </h3>
                  <span className="text-xs font-medium text-slate-500">{format(new Date(kyc.submittedAt || kyc.createdAt), 'MMM dd')}</span>
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3 truncate">{kyc.shopName || 'No Shop Name'}</p>
                <div className="flex gap-2">
                  {kyc.status === 'pending' && <span className="px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 rounded text-[10px] uppercase font-bold tracking-wider">Pending Review</span>}
                  {kyc.status === 'verified' && <span className="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 rounded text-[10px] uppercase font-bold tracking-wider">Verified</span>}
                  {kyc.status === 'rejected' && <span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-900/30 rounded text-[10px] uppercase font-bold tracking-wider">Rejected</span>}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANE: Document Detail Viewer */}
      <div className="flex-1 bg-slate-50 dark:bg-[#0a0a0a] overflow-y-auto custom-scrollbar">
        {selectedKyc ? (
          <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header / Actions */}
            <div className="flex items-start justify-between bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedKyc.fullName}</h2>
                <div className="flex gap-4 mt-2 text-sm text-muted-foreground font-mono font-medium">
                  <span>Retailer ID: <span className="text-slate-900 dark:text-slate-300">{selectedKyc.user?.retailerId}</span></span>
                  <span>Phone: <span className="text-slate-900 dark:text-slate-300">{selectedKyc.user?.phone}</span></span>
                </div>
              </div>
              
              {selectedKyc.status === 'pending' && (
                <div className="flex gap-3">
                  <Button
                    onClick={handleApprove}
                    disabled={isUpdating}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  >
                    {isUpdating ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                    Approve KYC
                  </Button>
                </div>
              )}
            </div>

            {/* PII Data Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Aadhaar Number (Raw)</label>
                <p className="font-mono text-lg font-bold text-slate-900 dark:text-white mt-1 tracking-widest">{selectedKyc.aadhaarNumber || 'Not Provided'}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">PAN Number (Raw)</label>
                <p className="font-mono text-lg font-bold text-slate-900 dark:text-white mt-1 tracking-widest">{selectedKyc.panNumber || 'Not Provided'}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date of Birth</label>
                <p className="font-medium text-slate-900 dark:text-white mt-1">{selectedKyc.dob || 'Not Provided'}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Business Details</label>
                <p className="font-medium text-slate-900 dark:text-white mt-1">{selectedKyc.shopName} ({selectedKyc.businessType || 'N/A'})</p>
              </div>
            </div>

            {/* Image Gallery */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: 'Aadhaar Front', url: selectedKyc.aadhaarFront },
                { label: 'Aadhaar Back', url: selectedKyc.aadhaarBack },
                { label: 'PAN Card', url: selectedKyc.panImage },
                { label: 'Live Selfie', url: selectedKyc.selfie },
                { label: 'Shop Photo', url: selectedKyc.shopPhoto },
              ].map((img, idx) => (
                <div key={idx} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-64 shadow-sm">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300">
                    {img.label}
                  </div>
                  <div className="flex-1 flex items-center justify-center bg-slate-100 dark:bg-black/40 p-2 relative group">
                    {img.url ? (
                      <img src={img.url} alt={img.label} className="max-w-full max-h-full object-contain rounded-lg shadow-sm" />
                    ) : (
                      <div className="flex flex-col items-center text-slate-400">
                        <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-xs font-medium">No Image Uploaded</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Rejection Form */}
            {selectedKyc.status === 'pending' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl mt-8 shadow-sm">
                <h3 className="text-red-600 dark:text-red-400 font-bold flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                    <XCircle className="w-4 h-4" />
                  </div>
                  Reject Application
                </h3>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Input 
                    type="text" 
                    placeholder="Provide specific reason (e.g. Aadhaar image is blurry, numbers do not match)" 
                    className="flex-1"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={isUpdating || rejectReason.length < 5}
                    className="whitespace-nowrap"
                  >
                    {isUpdating ? 'Processing...' : 'Confirm Rejection'}
                  </Button>
                </div>
              </div>
            )}
            
            {selectedKyc.status === 'rejected' && (
              <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-6 rounded-2xl shadow-sm">
                <h3 className="text-red-700 dark:text-red-400 font-bold mb-2">Rejection Reason</h3>
                <p className="text-red-600 dark:text-red-300 font-medium">{selectedKyc.remarks || 'No remarks provided.'}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center mb-6">
              <UserCheck className="w-10 h-10 text-slate-300 dark:text-slate-700" />
            </div>
            <p className="text-xl font-bold text-slate-700 dark:text-slate-300">Select an application</p>
            <p className="text-sm font-medium mt-1">Choose a retailer from the list to review documents</p>
          </div>
        )}
      </div>
    </div>
  );
}
