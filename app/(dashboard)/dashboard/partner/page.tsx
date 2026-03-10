"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import LoadingSpinner from "@/components/common/LoadingSpinner";

export default function PartnerPage() {
  const me = useQuery(api.queries.users.getMe);
  const coupleStatus = useQuery(api.queries.couples.getCoupleStatus);
  const generateCode = useMutation(api.mutations.couples.generatePairingCode);
  const linkPartner = useMutation(api.mutations.couples.linkPartnerWithCode);
  const updateSharing = useMutation(api.mutations.couples.updateSharingSettings);
  const revokeAccess = useMutation(api.mutations.couples.revokePartnerAccess);

  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  if (me === undefined || coupleStatus === undefined) return <LoadingSpinner />;

  const handleGenerateCode = async () => {
    setIsSubmitting(true);
    try {
      const result = await generateCode();
      setGeneratedCode(result.code);
      setMessage("Share this code with your partner!");
    } catch (error: any) {
      setMessage(error.message || "Failed to generate code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkPartner = async () => {
    if (code.length !== 6) return;
    setIsSubmitting(true);
    try {
      await linkPartner({ code });
      setCode("");
      setMessage("Successfully linked!");
    } catch (error: any) {
      setMessage(error.message || "Failed to link");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeAccess = async () => {
    if (!confirm("Are you sure you want to revoke partner access?")) return;
    setIsSubmitting(true);
    try {
      await revokeAccess();
      setMessage("Partner access revoked.");
    } catch (error: any) {
      setMessage(error.message || "Failed to revoke access");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Partner</h1>

      {message && (
        <div className="p-3 bg-blue-50 text-blue-800 rounded-xl text-sm">
          {message}
        </div>
      )}

      {/* Already linked */}
      {coupleStatus?.isLinked && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">💕</span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Connected</h2>
              <p className="text-sm text-gray-500">
                Linked with {coupleStatus.partner?.name ?? "your partner"}
              </p>
            </div>
          </div>

          {me?.role === "primary" && (
            <>
              <div className="border-t pt-4 space-y-3">
                <h3 className="text-sm font-medium text-gray-700">Sharing Settings</h3>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Share cycle phase</span>
                  <input
                    type="checkbox"
                    checked={coupleStatus.sharingSettings?.phase ?? true}
                    onChange={(e) => updateSharing({ sharingPhase: e.target.checked })}
                    className="h-5 w-5 rounded accent-primary-500"
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Share pain data</span>
                  <input
                    type="checkbox"
                    checked={coupleStatus.sharingSettings?.pain ?? false}
                    onChange={(e) => updateSharing({ sharingPain: e.target.checked })}
                    className="h-5 w-5 rounded accent-primary-500"
                  />
                </label>
              </div>

              <button
                onClick={handleRevokeAccess}
                className="w-full py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
              >
                Revoke Partner Access
              </button>
            </>
          )}
        </div>
      )}

      {/* Not linked - Primary user */}
      {!coupleStatus?.isLinked && me?.role === "primary" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Link Your Partner</h2>
          <p className="text-sm text-gray-600">
            Generate a pairing code and share it with your partner.
          </p>

          {generatedCode || coupleStatus?.activePairingCode ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-2">Your pairing code:</p>
              <p className="text-4xl font-mono font-bold tracking-widest text-primary-500">
                {generatedCode ?? coupleStatus?.activePairingCode?.code}
              </p>
              <p className="text-xs text-gray-400 mt-2">Valid for 24 hours</p>
            </div>
          ) : null}

          <button
            onClick={handleGenerateCode}
            disabled={isSubmitting}
            className="w-full py-3 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Generating..." : generatedCode ? "Generate New Code" : "Generate Pairing Code"}
          </button>
        </div>
      )}

      {/* Not linked - Partner user */}
      {!coupleStatus?.isLinked && me?.role === "partner" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Enter Pairing Code</h2>
          <p className="text-sm text-gray-600">
            Ask your partner for their 6-digit pairing code.
          </p>

          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Enter 6-digit code"
            className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            maxLength={6}
          />

          <button
            onClick={handleLinkPartner}
            disabled={isSubmitting || code.length !== 6}
            className="w-full py-3 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Linking..." : "Link Account"}
          </button>
        </div>
      )}
    </div>
  );
}
