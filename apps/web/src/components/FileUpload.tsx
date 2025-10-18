// File Upload Component with Progress and Micro-animations
import React, { useState, useRef, useCallback } from 'react';
import { useToastHelpers } from '../hooks/useToast';

interface FileUploadProps {
  onUpload: (files: File[]) => Promise<void>;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in bytes
  maxFiles?: number;
  className?: string;
  disabled?: boolean;
}

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export function FileUpload({
  onUpload,
  accept,
  multiple = false,
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 5,
  className = '',
  disabled = false,
}: FileUploadProps): React.ReactElement {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showError, showSuccess } = useToastHelpers();

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const getProgressWidthClass = (progress: number): string => {
    const rounded = Math.round(progress / 10) * 10;
    return `w-progress-${rounded}`;
  };

  const generateFileId = useCallback(() => {
    return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > maxSize) {
      return `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`;
    }
    return null;
  }, [maxSize]);

  const handleFiles = useCallback(async (fileList: FileList) => {
    if (disabled) return;

    const newFiles = Array.from(fileList);
    
    // Check file limits
    if (files.length + newFiles.length > maxFiles) {
      showError('Too many files', `Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate and prepare files
    const uploadFiles: UploadFile[] = [];
    for (const file of newFiles) {
      const error = validateFile(file);
      if (error) {
        showError('Invalid file', `${file.name}: ${error}`);
        continue;
      }

      uploadFiles.push({
        file,
        id: generateFileId(),
        progress: 0,
        status: 'pending',
      });
    }

    if (uploadFiles.length === 0) return;

    // Add files to state
    setFiles(prev => [...prev, ...uploadFiles]);

    try {
      // Start upload process
      await processUploads(uploadFiles);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  }, [disabled, files.length, maxFiles, showError, validateFile, generateFileId]);

  const processUploads = useCallback(async (uploadFiles: UploadFile[]) => {
    for (const uploadFile of uploadFiles) {
      try {
        // Update status to uploading
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'uploading' as const }
            : f
        ));

        // Simulate upload progress (replace with actual upload logic)
        for (let progress = 0; progress <= 100; progress += 10) {
          setFiles(prev => prev.map(f => 
            f.id === uploadFile.id 
              ? { ...f, progress }
              : f
          ));
          
          // Simulate upload delay
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Call the actual upload function
        await onUpload([uploadFile.file]);

        // Mark as completed
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'completed' as const, progress: 100 }
            : f
        ));

        showSuccess('Upload complete', `${uploadFile.file.name} uploaded successfully`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'error' as const, error: errorMessage }
            : f
        ));

        showError('Upload failed', `${uploadFile.file.name}: ${errorMessage}`, {
          label: 'Retry',
          onClick: () => retryUpload(uploadFile.id),
        });
      }
    }
  }, [onUpload, showSuccess, showError]);

  const retryUpload = useCallback((fileId: string) => {
    const fileToRetry = files.find(f => f.id === fileId);
    if (fileToRetry) {
      setFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { ...f, status: 'pending' as const, progress: 0, error: undefined }
          : f
      ));
      processUploads([fileToRetry]);
    }
  }, [files, processUploads]);

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;
    
    const droppedFiles = e.dataTransfer.files;
    handleFiles(droppedFiles);
  }, [disabled, handleFiles]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      handleFiles(selectedFiles);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  }, [handleFiles]);

  const openFileDialog = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'pending':
        return (
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
          </svg>
        );
      case 'uploading':
        return (
          <svg className={`w-4 h-4 text-blue-500 ${prefersReducedMotion ? '' : 'animate-spin'}`} fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      case 'completed':
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-all duration-200 ease-in-out
          ${isDragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-indigo-400 hover:bg-gray-50'}
          ${prefersReducedMotion ? '' : 'transform hover:scale-[1.02]'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload files"
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            openFileDialog();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInputChange}
          className="sr-only"
          disabled={disabled}
          aria-describedby="file-upload-description"
          aria-label="Choose files to upload"
        />

        <div className="flex flex-col items-center">
          <svg
            className={`w-12 h-12 text-gray-400 mb-4 ${
              prefersReducedMotion ? '' : 'transition-transform duration-200'
            } ${isDragOver && !prefersReducedMotion ? 'scale-110' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-xl font-medium text-gray-900 mb-2">
            {isDragOver ? 'Drop files here' : 'Upload files'}
          </p>
          <p id="file-upload-description" className="text-sm text-gray-500">
            Drag and drop files here or click to browse
            {maxFiles > 1 && ` (max ${maxFiles} files)`}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Max file size: {Math.round(maxSize / 1024 / 1024)}MB
          </p>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-900">Uploading Files</h3>
          <div className="space-y-2" role="list" aria-label="Upload progress">
            {files.map((uploadFile) => (
              <div
                key={uploadFile.id}
                className={`
                  bg-white border border-gray-200 rounded-lg p-3
                  ${prefersReducedMotion ? '' : 'transition-all duration-200'}
                `}
                role="listitem"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center min-w-0 flex-1">
                    <div className="flex-shrink-0">
                      {getStatusIcon(uploadFile.status)}
                    </div>
                    <div className="ml-3 min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {uploadFile.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {uploadFile.error && (
                        <p className="text-xs text-red-600 mt-1">{uploadFile.error}</p>
                      )}
                    </div>
                  </div>

                  {uploadFile.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => removeFile(uploadFile.id)}
                      className="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded"
                      aria-label={`Remove ${uploadFile.file.name}`}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Progress Bar */}
                {uploadFile.status === 'uploading' && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Uploading...</span>
                      <span>{uploadFile.progress}%</span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`
                          bg-indigo-600 h-full transition-all duration-300 ease-out
                          ${getProgressWidthClass(uploadFile.progress)}
                          ${prefersReducedMotion ? '' : 'animate-upload-progress'}
                        `}
                        role="progressbar"
                        aria-valuenow={uploadFile.progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Upload progress: ${uploadFile.progress} percent`}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}