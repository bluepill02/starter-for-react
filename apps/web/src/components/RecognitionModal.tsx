// Core RecognitionModal component for the Recognition App
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/auth';
import { useEvidenceUpload } from '../lib/useEvidenceUpload';
import { getFunctions } from '../appwrite/client';

interface RecognitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (recognition: any) => void;
}

interface RecognitionDraft {
  recipientEmail: string;
  tags: string[];
  reason: string;
  visibility: 'PRIVATE' | 'TEAM' | 'PUBLIC';
  evidenceIds: string[];
}

const STORAGE_KEY = 'recognition:draft';
const MIN_REASON_LENGTH = 20;
const MAX_TAGS = 3;

export function RecognitionModal({ isOpen, onClose, onSuccess }: RecognitionModalProps): React.ReactElement | null {
  const { currentUser } = useAuth();
  const functions = getFunctions();
  const { 
    files, 
    uploading, 
    addFiles, 
    removeFile, 
    uploadFiles, 
    clearFiles,
    maxFiles,
    maxFileSize 
  } = useEvidenceUpload();

  // Form state
  const [recipientEmail, setRecipientEmail] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [reason, setReason] = useState('');
  const [visibility, setVisibility] = useState<'PRIVATE' | 'TEAM' | 'PUBLIC'>('PRIVATE');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Refs for accessibility
  const recipientInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (isOpen) {
      const savedDraft = localStorage.getItem(STORAGE_KEY);
      if (savedDraft) {
        try {
          const draft: RecognitionDraft = JSON.parse(savedDraft);
          setRecipientEmail(draft.recipientEmail || '');
          setTags(draft.tags || []);
          setReason(draft.reason || '');
          setVisibility(draft.visibility || 'PRIVATE');
        } catch (error) {
          console.warn('Failed to load recognition draft:', error);
        }
      }
    }
  }, [isOpen]);

  // Save draft on changes
  useEffect(() => {
    if (isOpen && (recipientEmail || tags.length > 0 || reason)) {
      const draft: RecognitionDraft = {
        recipientEmail,
        tags,
        reason,
        visibility,
        evidenceIds: files.filter(f => f.uploaded).map(f => f.storageId!),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    }
  }, [recipientEmail, tags, reason, visibility, files, isOpen]);

  // Clear draft when modal closes successfully
  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
    setRecipientEmail('');
    setTags([]);
    setNewTag('');
    setReason('');
    setVisibility('PRIVATE');
    clearFiles();
    setErrors({});
  };

  // Focus management for accessibility
  useEffect(() => {
    if (isOpen && recipientInputRef.current) {
      setTimeout(() => recipientInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!recipientEmail.trim()) {
      newErrors.recipientEmail = 'Recipient email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      newErrors.recipientEmail = 'Invalid email format';
    }

    if (tags.length === 0) {
      newErrors.tags = 'At least one recognition tag is required';
    }

    if (!reason.trim()) {
      newErrors.reason = 'Recognition reason is required';
    } else if (reason.trim().length < MIN_REASON_LENGTH) {
      newErrors.reason = `Reason must be at least ${MIN_REASON_LENGTH} characters for evidence-weighted recognition`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Tag management
  const addTag = () => {
    if (newTag.trim() && tags.length < MAX_TAGS && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // File handling
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (selectedFiles) {
      addFiles(selectedFiles);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const droppedFiles = event.dataTransfer.files;
    if (droppedFiles) {
      addFiles(droppedFiles);
    }
  };

  // Submit recognition
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!validateForm()) {
      // Focus first error field
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField === 'recipientEmail' && recipientInputRef.current) {
        recipientInputRef.current.focus();
      }
      return;
    }

    setSubmitting(true);
    
    try {
      // Upload evidence files first
      const evidenceIds = files.length > 0 ? await uploadFiles() : [];
      
      // Create recognition via Appwrite Function
      const recognition = await functions.createExecution(
        'create-recognition',
        JSON.stringify({
          recipientEmail: recipientEmail.trim(),
          tags,
          reason: reason.trim(),
          visibility,
          evidenceIds,
          giverUserId: currentUser?.$id,
        })
      );

      const recognitionData = JSON.parse(recognition.responseBody || '{}');
      
      // Clear draft and close modal
      clearDraft();
      onClose();
      
      // Notify parent of success
      onSuccess?.(recognitionData);
      
      // Announce success
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.textContent = `Recognition sent successfully to ${recipientEmail}`;
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 2000);

    } catch (error) {
      console.error('Failed to create recognition:', error);
      setErrors({ 
        submit: error instanceof Error ? error.message : 'Failed to create recognition' 
      });
      
      // Announce error
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'assertive');
      announcement.className = 'sr-only';
      announcement.textContent = 'Failed to create recognition';
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 2000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (recipientEmail || tags.length > 0 || reason || files.length > 0) {
      // Keep draft for later
      const draft: RecognitionDraft = {
        recipientEmail,
        tags,
        reason,
        visibility,
        evidenceIds: files.filter(f => f.uploaded).map(f => f.storageId!),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Give Recognition</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
              aria-label="Close modal"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Recipient Email */}
            <div className="space-y-2">
              <label htmlFor="recipient" className="block text-sm font-medium text-gray-700">
                Recipient Email *
              </label>
              <input
                id="recipient"
                ref={recipientInputRef}
                type="email"
                value={recipientEmail}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipientEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-describedby={errors.recipientEmail ? 'recipient-error' : undefined}
                aria-invalid={errors.recipientEmail ? true : false}
                required
              />
              {errors.recipientEmail && (
                <p id="recipient-error" className="text-sm text-red-600" role="alert">
                  {errors.recipientEmail}
                </p>
              )}
            </div>

            {/* Recognition Tags */}
            <div className="space-y-2">
              <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
                Recognition Tags * (max {MAX_TAGS})
              </label>
              <div className="flex gap-2">
                <input
                  id="tags"
                  value={newTag}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTag(e.target.value)}
                  placeholder="teamwork, innovation, leadership..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  disabled={tags.length >= MAX_TAGS}
                />
                <button 
                  type="button" 
                  onClick={addTag}
                  disabled={!newTag.trim() || tags.length >= MAX_TAGS}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
              
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:bg-red-100 rounded-full p-1"
                        aria-label={`Remove ${tag} tag`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              
              {errors.tags && (
                <p className="text-sm text-red-600" role="alert">
                  {errors.tags}
                </p>
              )}
            </div>

            {/* Recognition Reason */}
            <div className="space-y-2">
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
                Recognition Reason *
                <span className="text-sm text-gray-500 ml-2">
                  ({reason.length}/{MIN_REASON_LENGTH} min)
                </span>
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                placeholder="Describe what this person did and why they deserve recognition. Be specific about their actions and impact. Detailed reasons with evidence carry more weight in the recognition system."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                aria-describedby={errors.reason ? 'reason-error' : 'reason-help'}
                aria-invalid={errors.reason ? true : false}
                minLength={MIN_REASON_LENGTH}
                required
              />
              <p id="reason-help" className="text-sm text-gray-600">
                Detailed reasons with evidence have higher recognition weight
              </p>
              {errors.reason && (
                <p id="reason-error" className="text-sm text-red-600" role="alert">
                  {errors.reason}
                </p>
              )}
            </div>

            {/* Evidence Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Evidence (Optional)</label>
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <div className="mx-auto h-8 w-8 text-gray-400 mb-2">📎</div>
                <p className="text-sm text-gray-600 mb-2">
                  Drag & drop evidence files or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:underline"
                  >
                    browse files
                  </button>
                </p>
                <p className="text-xs text-gray-500">
                  Max {maxFiles} files, {maxFileSize / 1024 / 1024}MB each
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  className="hidden"
                  aria-describedby="file-help"
                  aria-label="Upload evidence files"
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div key={file.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <span className="h-4 w-4 text-blue-600">
                        {file.file.type.startsWith('image/') ? '🖼️' : '📄'}
                      </span>
                      <span className="flex-1 text-sm truncate">{file.file.name}</span>
                      {file.error && (
                        <span className="text-red-600" title={file.error}>⚠️</span>
                      )}
                      {file.uploaded && (
                        <span className="text-xs text-green-600 border border-green-200 rounded px-2 py-1">
                          Uploaded
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        className="p-1 hover:bg-red-100 rounded"
                        aria-label={`Remove ${file.file.name}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Privacy Settings */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">Privacy & Visibility</label>
              
              <div className="space-y-3">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    value="PRIVATE"
                    checked={visibility === 'PRIVATE'}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVisibility(e.target.value as any)}
                    className="mt-1 focus:ring-2 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium">Private</div>
                    <div className="text-sm text-gray-600">Only you and the recipient can see this</div>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    value="TEAM"
                    checked={visibility === 'TEAM'}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVisibility(e.target.value as any)}
                    className="mt-1 focus:ring-2 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium">Team</div>
                    <div className="text-sm text-gray-600">Visible to your team members</div>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    value="PUBLIC"
                    checked={visibility === 'PUBLIC'}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVisibility(e.target.value as any)}
                    className="mt-1 focus:ring-2 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium">Public</div>
                    <div className="text-sm text-gray-600">Visible to everyone in the organization</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600" role="alert">
                  {errors.submit}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button 
                type="button" 
                onClick={handleClose}
                disabled={submitting || uploading}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={submitting || uploading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Sending Recognition...' : 'Send Recognition'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}