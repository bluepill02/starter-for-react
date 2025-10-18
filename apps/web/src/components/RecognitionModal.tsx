// Core RecognitionModal component for the Recognition App
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { useEvidenceUpload } from '../lib/useEvidenceUpload';
import { useI18n, translate } from '../lib/i18n';
import { getFunctions, getDatabase } from '../appwrite/client';
import { announcePolite, announceAssertive } from '../lib/liveRegion';

// Extend Window interface to include feedPageActions
declare global {
  interface Window {
    feedPageActions?: {
      addOptimisticRecognition: (recognition: any) => void;
      rollbackOptimisticRecognition: (id: string) => void;
    };
  }
}

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

interface UserSuggestion {
  $id: string;
  email: string;
  name?: string;
  avatar?: string;
}

const STORAGE_KEY = 'recognition:draft';
const MIN_REASON_LENGTH = 20;
const MAX_TAGS = 3;

export function RecognitionModal({ isOpen, onClose, onSuccess }: RecognitionModalProps): React.ReactElement | null {
  const { currentUser } = useAuth();
  const functions = getFunctions();
  const database = getDatabase();
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
  const [recipientSuggestions, setRecipientSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [reason, setReason] = useState('');
  const [visibility, setVisibility] = useState<'PRIVATE' | 'TEAM' | 'PUBLIC'>('PRIVATE');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draftRestored, setDraftRestored] = useState(false);

  // Refs for accessibility
  const recipientInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

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
          setDraftRestored(true);
          announcePolite(translate('recognize.draft_restored'));
        } catch (error) {
          console.warn('Failed to load recognition draft:', error);
        }
      }
    }
  }, [isOpen]);

  // Search for user suggestions when typing recipient email
  useEffect(() => {
    const searchUsers = async () => {
      if (recipientEmail.length < 2) {
        setRecipientSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      try {
        // Search users in the database by email or name
        const results = await database.listDocuments(
          'main', // database ID
          'users', // collection ID
          [
            // Search by email starting with the input
            `search("${recipientEmail}")`,
          ]
        );

        const suggestions: UserSuggestion[] = results.documents
          .filter(user => user.$id !== currentUser?.$id) // Don't suggest self
          .slice(0, 5) // Limit to 5 suggestions
          .map(user => ({
            $id: user.$id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
          }));

        setRecipientSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
      } catch (error) {
        // Silently fail user search - not critical
        console.warn('User search failed:', error);
        setRecipientSuggestions([]);
        setShowSuggestions(false);
      }
    };

    const timeoutId = setTimeout(searchUsers, 300); // Debounce search
    return () => clearTimeout(timeoutId);
  }, [recipientEmail, database, currentUser]);

  // Hide suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !recipientInputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Focus management and focus trap for accessibility
  useEffect(() => {
    if (!isOpen) return;
    // store last focused element to restore on close
    lastFocusedRef.current = (document.activeElement as HTMLElement) || null;
    const focusFirst = () => {
      if (recipientInputRef.current) {
        recipientInputRef.current.focus();
        return;
      }
      const focusables = modalRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusables && focusables[0]?.focus();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
      if (e.key === 'Tab') {
        const focusables = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;
        const list = Array.from(focusables).filter(el => !el.hasAttribute('disabled'));
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    setTimeout(focusFirst, 50);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // restore focus
      if (lastFocusedRef.current) {
        lastFocusedRef.current.focus();
      }
    };
  }, [isOpen]);

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!recipientEmail.trim()) {
      newErrors.recipientEmail = translate('recognize.validation.recipient_required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      newErrors.recipientEmail = translate('recognize.validation.recipient_invalid');
    }

    if (tags.length === 0) {
      newErrors.tags = translate('recognize.validation.tags_required');
    } else if (tags.length > MAX_TAGS) {
      newErrors.tags = translate('recognize.validation.tags_max', { max: MAX_TAGS.toString() });
    }

    if (!reason.trim()) {
      newErrors.reason = translate('recognize.validation.reason_required');
    } else if (reason.trim().length < MIN_REASON_LENGTH) {
      newErrors.reason = translate('recognize.validation.reason_min', { min: MIN_REASON_LENGTH.toString() });
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

  // Handle recipient selection from suggestions
  const selectRecipient = (suggestion: UserSuggestion) => {
    setRecipientEmail(suggestion.email);
    setShowSuggestions(false);
    setErrors(prev => ({ ...prev, recipientEmail: '' }));
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
    
    // Telemetry: Recognition creation started
    try {
      if (typeof window !== 'undefined' && 'gtag' in window) {
        (window as any).gtag('event', 'recognition_create_started', {
          evidence_count: files.length,
          has_evidence: files.length > 0,
          visibility: visibility.toLowerCase(),
          reason_length: reason.length,
          tags_count: tags.length,
        });
      }
    } catch (e) {
      // Silently ignore telemetry errors
    }
    
    // Create optimistic recognition data for immediate UI feedback
    const optimisticRecognition = {
      $id: `temp-${Date.now()}`,
      recipientEmail: recipientEmail.trim(),
      recipientName: recipientSuggestions.find(s => s.email === recipientEmail.trim())?.name || recipientEmail.trim(),
      tags,
      reason: reason.trim(),
      visibility,
      evidenceIds: [] as string[],
      giverUserId: currentUser?.$id,
      giverName: currentUser?.name || 'You',
      createdAt: new Date().toISOString(),
      pending: true,
    };
    
    try {
      // Upload evidence files first
      const evidenceIds = files.length > 0 ? await uploadFiles() : [];
      optimisticRecognition.evidenceIds = evidenceIds;
      
      // Add optimistic recognition to feed if function exists
      if (typeof window !== 'undefined' && 
          window.feedPageActions && 
          typeof window.feedPageActions.addOptimisticRecognition === 'function') {
        window.feedPageActions.addOptimisticRecognition(optimisticRecognition);
      }
      
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
      
      // Telemetry: Recognition creation succeeded
      try {
        if (typeof window !== 'undefined' && 'gtag' in window) {
          (window as any).gtag('event', 'recognition_create_success', {
            recognition_id: recognitionData.$id,
            evidence_count: files.length,
            has_evidence: files.length > 0,
            visibility: visibility.toLowerCase(),
            reason_length: reason.length,
            tags_count: tags.length,
          });
        }
      } catch (e) {
        // Silently ignore telemetry errors
      }
      
      // Clear draft and close modal
      clearDraft();
      onClose();
      
      // Notify parent of success
      onSuccess?.(recognitionData);
      
      // Announce success
      announcePolite(translate('recognize.success', { recipient: recipientEmail.trim() }));

    } catch (error) {
      console.error('Failed to create recognition:', error);
      
      // Rollback optimistic recognition if it was added
      if (typeof window !== 'undefined' && 
          window.feedPageActions && 
          typeof window.feedPageActions.rollbackOptimisticRecognition === 'function') {
        window.feedPageActions.rollbackOptimisticRecognition(optimisticRecognition.$id);
      }
      
      // Telemetry: Recognition creation failed
      try {
        if (typeof window !== 'undefined' && 'gtag' in window) {
          (window as any).gtag('event', 'recognition_create_error', {
            error_message: error instanceof Error ? error.message : 'Unknown error',
            evidence_count: files.length,
            has_evidence: files.length > 0,
            visibility: visibility.toLowerCase(),
          });
        }
      } catch (e) {
        // Silently ignore telemetry errors
      }
      
      setErrors({ 
        submit: error instanceof Error ? error.message : translate('recognize.error_submit')
      });
      
      // Announce error
      announceAssertive(translate('recognize.error_submit'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = useCallback(() => {
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
  }, [recipientEmail, tags, reason, files, visibility, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="recognition-modal-title">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div ref={modalRef} className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 id="recognition-modal-title" className="text-xl font-semibold text-gray-900">
                {translate('recognize.title')}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {translate('recognize.subtitle')}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
              aria-label={translate('recognize.close')}
            >
              ×
            </button>
          </div>

          {draftRestored && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-600">
                {translate('recognize.draft_restored')}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Recipient Email with Suggestions */}
            <div className="space-y-2 relative">
              <label htmlFor="recipient" className="block text-sm font-medium text-gray-700">
                {translate('recognize.recipient')}
              </label>
              <div className="relative">
                <input
                  id="recipient"
                  ref={recipientInputRef}
                  type="email"
                  value={recipientEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setRecipientEmail(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(recipientSuggestions.length > 0)}
                  placeholder={translate('recognize.recipient_placeholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-describedby={errors.recipientEmail ? 'recipient-error' : 'recipient-help'}
                  aria-invalid={errors.recipientEmail ? "true" : "false"}
                  required
                />
                
                {/* Recipient Suggestions Dropdown */}
                {showSuggestions && recipientSuggestions.length > 0 && (
                  <div 
                    ref={suggestionsRef}
                    className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
                  >
                    {recipientSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.$id}
                        type="button"
                        onClick={() => selectRecipient(suggestion)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            {suggestion.avatar ? (
                              <img 
                                src={suggestion.avatar} 
                                alt="" 
                                className="w-8 h-8 rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                                <span className="text-xs font-medium text-gray-600">
                                  {suggestion.name ? suggestion.name.charAt(0).toUpperCase() : suggestion.email.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {suggestion.name || suggestion.email}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {suggestion.email}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <p id="recipient-help" className="text-sm text-gray-600">
                {translate('recognize.recipient_help')}
              </p>
              
              {errors.recipientEmail && (
                <p id="recipient-error" className="text-sm text-red-600" role="alert">
                  {errors.recipientEmail}
                </p>
              )}
            </div>

            {/* Recognition Tags */}
            <div className="space-y-2">
              <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
                {translate('recognize.tags')}
              </label>
              <div className="flex gap-2">
                <input
                  id="tags"
                  value={newTag}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTag(e.target.value)}
                  placeholder={translate('recognize.tags_placeholder')}
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
              
              <p className="text-sm text-gray-600">
                {translate('recognize.tags_help', { max: MAX_TAGS.toString() })}
              </p>
              
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
                {translate('recognize.reason_label')}
                <span className="text-sm text-gray-500 ml-2">
                  {translate('recognize.reason_counter', { 
                    current: reason.length.toString(),
                    min: MIN_REASON_LENGTH.toString() 
                  })}
                </span>
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                placeholder={translate('recognize.reason_placeholder')}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                aria-describedby={errors.reason ? 'reason-error' : 'reason-help'}
                aria-invalid={!!errors.reason ? "true" : "false"}
                minLength={MIN_REASON_LENGTH}
                required
              />
              <p id="reason-help" className="text-sm text-gray-600">
                {translate('recognize.reason_help')}
              </p>
              {errors.reason && (
                <p id="reason-error" className="text-sm text-red-600" role="alert">
                  {errors.reason}
                </p>
              )}
            </div>

            {/* Evidence Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {translate('recognize.evidence')}
              </label>
              <p className="text-sm text-gray-600">
                {translate('recognize.evidence_subtitle')}
              </p>
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <div className="mx-auto h-8 w-8 text-gray-400 mb-2">📎</div>
                <p className="text-sm text-gray-600 mb-2">
                  {translate('recognize.evidence_dragdrop').split('browse files')[0]}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:underline"
                  >
                    browse files
                  </button>
                </p>
                <p className="text-xs text-gray-500 mb-1">
                  {translate('recognize.evidence_formats')}
                </p>
                <p className="text-xs text-gray-500">
                  {translate('recognize.evidence_limits', { 
                    maxFiles: maxFiles.toString(),
                    maxSize: (maxFileSize / 1024 / 1024).toString()
                  })}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  className="hidden"
                  aria-describedby="file-help"
                  aria-label={translate('recognize.evidence')}
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div key={file.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      {/* File Preview */}
                      <div className="flex-shrink-0">
                        {file.file.type.startsWith('image/') ? (
                          <div className="relative">
                            <img
                              src={URL.createObjectURL(file.file)}
                              alt={file.file.name}
                              className="w-12 h-12 object-cover rounded border"
                              onError={(e) => {
                                // Fallback to icon if image fails to load
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 bg-blue-600 text-white rounded flex items-center justify-center text-xs">
                              🖼️
                            </div>
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-blue-100 rounded flex items-center justify-center text-blue-600">
                            📄
                          </div>
                        )}
                      </div>
                      
                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(file.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        
                        {/* Upload Progress/Status */}
                        {uploading && !file.uploaded && !file.error && (
                          <div className="mt-1">
                            <div className="w-full bg-gray-200 rounded-full h-1">
                              <div className="bg-blue-600 h-1 rounded-full animate-pulse w-3/5" />
                            </div>
                            <p className="text-xs text-blue-600 mt-1">
                              {translate('recognize.evidence_uploading')}
                            </p>
                          </div>
                        )}
                        
                        {file.error && (
                          <p className="text-xs text-red-600 mt-1" title={file.error}>
                            {translate('recognize.evidence_error')}
                          </p>
                        )}
                        
                        {file.uploaded && (
                          <p className="text-xs text-green-600 mt-1">
                            {translate('recognize.evidence_uploaded')}
                          </p>
                        )}
                      </div>
                      
                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        className="p-2 hover:bg-red-100 rounded-full text-gray-400 hover:text-red-600"
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
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {translate('recognize.visibility.label')}
                </label>
                <p className="text-sm text-gray-600 mt-1">
                  {translate('recognize.visibility.subtitle')}
                </p>
              </div>
              
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
                    <div className="font-medium">{translate('recognize.visibility.private')}</div>
                    <div className="text-sm text-gray-600">{translate('recognize.visibility.private_desc')}</div>
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
                    <div className="font-medium">{translate('recognize.visibility.team')}</div>
                    <div className="text-sm text-gray-600">{translate('recognize.visibility.team_desc')}</div>
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
                    <div className="font-medium">{translate('recognize.visibility.public')}</div>
                    <div className="text-sm text-gray-600">{translate('recognize.visibility.public_desc')}</div>
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
                {translate('recognize.cancel')}
              </button>
              <button 
                type="submit" 
                disabled={submitting || uploading}
                aria-busy={submitting || uploading ? "true" : "false"}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? translate('recognize.submitting') : translate('recognize.submit')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}