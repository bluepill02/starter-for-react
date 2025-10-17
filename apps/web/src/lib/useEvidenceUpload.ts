// Evidence upload hook for production Recognition App
import { useState, useCallback } from 'react';
import { ID } from 'appwrite';
import { z } from 'zod';
import { getStorage, getFunctions } from '../appwrite/client';
// import { useI18n } from './i18n'; // For future internationalization

// Zod validation schema for evidence files
const EvidenceFileSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum([
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]),
  size: z.number().max(10 * 1024 * 1024) // 10MB limit
});

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface EvidenceFile {
  id: string;
  file: File;
  preview?: string;
  uploadProgress?: UploadProgress;
  uploaded: boolean;
  storageId?: string;
  error?: string;
}

interface UseEvidenceUploadReturn {
  files: EvidenceFile[];
  uploading: boolean;
  addFiles: (files: FileList | File[]) => void;
  removeFile: (id: string) => void;
  uploadFiles: () => Promise<string[]>;
  clearFiles: () => void;
  maxFiles: number;
  maxFileSize: number;
  supportedTypes: string[];
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPORTED_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export function useEvidenceUpload(): UseEvidenceUploadReturn {
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const storage = getStorage();
  const functions = getFunctions();

  const validateFile = (file: File): string | null => {
    try {
      // Use Zod schema to validate file properties
      EvidenceFileSchema.parse({
        name: file.name,
        type: file.type,
        size: file.size
      });
      return null;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issue = error.issues[0];
        if (issue.path.includes('size')) {
          return `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum ${MAX_FILE_SIZE / 1024 / 1024}MB`;
        }
        if (issue.path.includes('type')) {
          return `File type ${file.type} is not supported`;
        }
        if (issue.path.includes('name')) {
          return 'File name is invalid';
        }
        return `Invalid file: ${issue.message}`;
      }
      return 'File validation failed';
    }
  };

  const generatePreview = (file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(file);
      } else {
        resolve(undefined);
      }
    });
  };

  const addFiles = useCallback(async (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    
    if (files.length + fileArray.length > MAX_FILES) {
      // Create a temporary ARIA live region announcement
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.textContent = `Maximum ${MAX_FILES} evidence files allowed`;
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);
      return;
    }

    const validatedFiles: EvidenceFile[] = [];
    
    for (const file of fileArray) {
      const error = validateFile(file);
      const preview = await generatePreview(file);
      
      validatedFiles.push({
        id: ID.unique(),
        file,
        preview,
        uploaded: false,
        error: error || undefined
      });
    }

    setFiles(prev => [...prev, ...validatedFiles]);

    // Announce successful file addition
    if (validatedFiles.length > 0) {
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.className = 'sr-only';
      announcement.textContent = `${validatedFiles.length} files added for evidence upload`;
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);
    }
  }, [files.length]);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => {
      const newFiles = prev.filter(f => f.id !== id);
      
      // Announce file removal
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.className = 'sr-only';
      announcement.textContent = 'Evidence file removed';
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);
      
      return newFiles;
    });
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  const uploadFiles = useCallback(async (): Promise<string[]> => {
    if (files.length === 0) return [];
    
    const validFiles = files.filter(f => !f.error);
    if (validFiles.length === 0) return [];

    setUploading(true);
    const storageIds: string[] = [];

    try {
      // Upload files using secure presign-upload workflow
      for (const evidenceFile of validFiles) {
        try {
          // Announce upload start
          const announcement = document.createElement('div');
          announcement.setAttribute('aria-live', 'polite');
          announcement.className = 'sr-only';
          announcement.textContent = `Uploading ${evidenceFile.file.name}...`;
          document.body.appendChild(announcement);
          setTimeout(() => document.body.removeChild(announcement), 1000);

          // Update progress
          setFiles(prev => prev.map(f => 
            f.id === evidenceFile.id 
              ? { ...f, uploadProgress: { loaded: 0, total: evidenceFile.file.size, percentage: 0 } }
              : f
          ));

          // Step 1: Request presigned upload token/URL
          const presignResponse = await functions.createExecution(
            'presign-upload',
            JSON.stringify({
              filename: evidenceFile.file.name,
              fileType: evidenceFile.file.type,
              fileSize: evidenceFile.file.size
            })
          );

          const presignData = JSON.parse(presignResponse.responseBody || '{}');
          if (!presignData.success) {
            throw new Error(presignData.error || 'Failed to get upload permission');
          }

          // Step 2: Upload directly to Appwrite Storage using presigned data
          const storageId = presignData.storageId;
          
          // Upload to Appwrite Storage
          await storage.createFile(
            'evidence', // bucket ID
            storageId,
            evidenceFile.file
          );

          // Update progress to 100% after successful upload
          setFiles(prev => prev.map(f => 
            f.id === evidenceFile.id 
              ? { 
                  ...f, 
                  uploadProgress: { 
                    loaded: evidenceFile.file.size, 
                    total: evidenceFile.file.size, 
                    percentage: 100
                  } 
                }
              : f
          ));

          // Announce upload completion
          const completionAnnouncement = document.createElement('div');
          completionAnnouncement.setAttribute('aria-live', 'polite');
          completionAnnouncement.className = 'sr-only';
          completionAnnouncement.textContent = `${evidenceFile.file.name} upload complete`;
          document.body.appendChild(completionAnnouncement);
          setTimeout(() => document.body.removeChild(completionAnnouncement), 1000);

          // Mark as uploaded
          setFiles(prev => prev.map(f => 
            f.id === evidenceFile.id 
              ? { ...f, uploaded: true, storageId }
              : f
          ));

          storageIds.push(storageId);

          // Step 3: Trigger preview generation asynchronously
          try {
            await functions.createExecution(
              'evidence-preview',
              JSON.stringify({
                storageId,
                filename: evidenceFile.file.name,
                fileType: evidenceFile.file.type,
                fileSize: evidenceFile.file.size
              })
            );
          } catch (previewError) {
            console.warn('Preview generation failed:', previewError);
            // Don't fail the upload if preview generation fails
          }

        } catch (uploadError) {
          console.error('Upload failed for file:', evidenceFile.file.name, uploadError);
          
          setFiles(prev => prev.map(f => 
            f.id === evidenceFile.id 
              ? { ...f, error: uploadError instanceof Error ? uploadError.message : 'Upload failed' }
              : f
          ));

          // Announce individual file error
          const errorAnnouncement = document.createElement('div');
          errorAnnouncement.setAttribute('aria-live', 'assertive');
          errorAnnouncement.className = 'sr-only';
          errorAnnouncement.textContent = `Upload failed for ${evidenceFile.file.name}`;
          document.body.appendChild(errorAnnouncement);
          setTimeout(() => document.body.removeChild(errorAnnouncement), 2000);
        }
      }

      // Announce completion
      if (storageIds.length > 0) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = `${storageIds.length} evidence files uploaded successfully`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 2000);
      }

      return storageIds;

    } catch (error) {
      console.error('Evidence upload failed:', error);
      
      // Announce general error
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'assertive');
      announcement.className = 'sr-only';
      announcement.textContent = 'Evidence upload failed';
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 2000);
      
      throw error;
    } finally {
      setUploading(false);
    }
  }, [files, storage, functions]);

  return {
    files,
    uploading,
    addFiles,
    removeFile,
    uploadFiles,
    clearFiles,
    maxFiles: MAX_FILES,
    maxFileSize: MAX_FILE_SIZE,
    supportedTypes: SUPPORTED_TYPES
  };
}