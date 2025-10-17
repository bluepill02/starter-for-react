import { renderHook, act, waitFor } from '@testing-library/react';
import { jest, describe, it, beforeEach, expect } from '@jest/globals';
import { useEvidenceUpload } from '../../../apps/web/src/lib/useEvidenceUpload.js';

// Mock Appwrite client
const mockAccount = {
  get: jest.fn(),
};

const mockStorage = {
  createFile: jest.fn(),
  getFilePreview: jest.fn(),
};

const mockFunctions = {
  createExecution: jest.fn(),
};

jest.mock('../../../apps/web/src/lib/appwrite.js', () => ({
  account: mockAccount,
  storage: mockStorage,
  functions: mockFunctions,
  ID: {
    unique: () => 'mock-unique-id',
  },
}));

// Mock file for testing
const createMockFile = (name, type, size) => {
  const file = new File(['test content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('useEvidenceUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockAccount.get.mockResolvedValue({ 
      $id: 'user123',
      name: 'Test User' 
    });
    
    mockFunctions.createExecution.mockResolvedValue({
      responseBody: JSON.stringify({
        uploadToken: 'mock-token',
        storageId: 'mock-storage-id',
        auditId: 'audit-123'
      })
    });
    
    mockStorage.createFile.mockResolvedValue({
      $id: 'file-123',
      name: 'test.jpg',
      sizeOriginal: 1024
    });
    
    mockStorage.getFilePreview.mockReturnValue('https://preview.url/thumb.jpg');
  });

  describe('File Validation', () => {
    it('should accept valid image files', async () => {
      const { result } = renderHook(() => useEvidenceUpload());
      
      const validFile = createMockFile('test.jpg', 'image/jpeg', 1024 * 1024); // 1MB
      
      await act(async () => {
        await result.current.uploadFiles([validFile]);
      });

      expect(mockFunctions.createExecution).toHaveBeenCalledWith(
        'presign-upload',
        expect.stringContaining('test.jpg')
      );
    });

    it('should reject files that are too large', async () => {
      const { result } = renderHook(() => useEvidenceUpload());
      
      const largeFile = createMockFile('large.jpg', 'image/jpeg', 51 * 1024 * 1024); // 51MB
      
      await act(async () => {
        await result.current.uploadFiles([largeFile]);
      });

      expect(result.current.error).toBe('File "large.jpg" exceeds maximum size of 50MB');
      expect(mockFunctions.createExecution).not.toHaveBeenCalled();
    });

    it('should reject invalid file types', async () => {
      const { result } = renderHook(() => useEvidenceUpload());
      
      const invalidFile = createMockFile('malware.exe', 'application/exe', 1024);
      
      await act(async () => {
        await result.current.uploadFiles([invalidFile]);
      });

      expect(result.current.error).toBe('File type "application/exe" is not supported');
      expect(mockFunctions.createExecution).not.toHaveBeenCalled();
    });

    it('should handle multiple files with mixed validation results', async () => {
      const { result } = renderHook(() => useEvidenceUpload());
      
      const validFile = createMockFile('valid.jpg', 'image/jpeg', 1024);
      const invalidFile = createMockFile('invalid.exe', 'application/exe', 1024);
      
      await act(async () => {
        await result.current.uploadFiles([validFile, invalidFile]);
      });

      // Should process valid file and report error for invalid
      expect(result.current.error).toContain('File type "application/exe" is not supported');
      expect(mockFunctions.createExecution).toHaveBeenCalledTimes(1);
    });
  });

  describe('Upload Process', () => {
    it('should handle successful upload workflow', async () => {
      const { result } = renderHook(() => useEvidenceUpload());
      
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      
      await act(async () => {
        await result.current.uploadFiles([file]);
      });

      // Verify presign request
      expect(mockFunctions.createExecution).toHaveBeenCalledWith(
        'presign-upload',
        expect.stringContaining('test.jpg')
      );

      // Verify file upload
      expect(mockStorage.createFile).toHaveBeenCalledWith(
        expect.any(String), // bucket ID
        'mock-storage-id',
        file,
        expect.any(Array) // permissions
      );

      // Verify successful upload state
      expect(result.current.isUploading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.uploadedFiles).toHaveLength(1);
    });

    it('should handle presign failure', async () => {
      const { result } = renderHook(() => useEvidenceUpload());
      
      mockFunctions.createExecution.mockRejectedValue(
        new Error('Presign failed')
      );
      
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      
      await act(async () => {
        await result.current.uploadFiles([file]);
      });

      expect(result.current.error).toBe('Upload authorization failed: Presign failed');
      expect(result.current.isUploading).toBe(false);
      expect(mockStorage.createFile).not.toHaveBeenCalled();
    });

    it('should handle upload failure', async () => {
      const { result } = renderHook(() => useEvidenceUpload());
      
      mockStorage.createFile.mockRejectedValue(
        new Error('Storage error')
      );
      
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      
      await act(async () => {
        await result.current.uploadFiles([file]);
      });

      expect(result.current.error).toBe('Upload failed: Storage error');
      expect(result.current.isUploading).toBe(false);
    });
  });

  describe('Progress Tracking', () => {
    it('should track upload progress correctly', async () => {
      const { result } = renderHook(() => useEvidenceUpload());
      
      const progressCallback = jest.fn();
      result.current.onProgress = progressCallback;
      
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      
      await act(async () => {
        await result.current.uploadFiles([file]);
      });

      // Verify progress callbacks were made
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          totalFiles: 1,
          completedFiles: 0,
          currentFileName: 'test.jpg'
        })
      );

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          totalFiles: 1,
          completedFiles: 1,
          currentFileName: 'test.jpg'
        })
      );
    });

    it('should set uploading state correctly during upload', async () => {
      const { result } = renderHook(() => useEvidenceUpload());
      
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      
      // Mock slow upload to test intermediate state
      let resolveUpload;
      const uploadPromise = new Promise(resolve => {
        resolveUpload = resolve;
      });
      
      mockStorage.createFile.mockImplementation(() => {
        return uploadPromise;
      });
      
      const uploadTask = act(async () => {
        await result.current.uploadFiles([file]);
      });
      
      // Check uploading state is true during upload
      await waitFor(() => {
        expect(result.current.isUploading).toBe(true);
      });
      
      // Complete the upload
      act(() => {
        resolveUpload({
          $id: 'file-123',
          name: 'test.jpg',
          sizeOriginal: 1024
        });
      });
      
      await uploadTask;
      
      // Check uploading state is false after completion
      expect(result.current.isUploading).toBe(false);
    });
  });

  describe('Accessibility', () => {
    it('should announce upload progress to screen readers', async () => {
      const { result } = renderHook(() => useEvidenceUpload());
      
      // Mock ARIA live region
      const mockLiveRegion = document.createElement('div');
      mockLiveRegion.setAttribute('aria-live', 'polite');
      document.body.appendChild(mockLiveRegion);
      
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      
      await act(async () => {
        await result.current.uploadFiles([file]);
      });

      // Verify announcements were made
      expect(result.current.statusMessage).toContain('Upload completed');
      
      document.body.removeChild(mockLiveRegion);
    });

    it('should provide descriptive error messages', async () => {
      const { result } = renderHook(() => useEvidenceUpload());
      
      const invalidFile = createMockFile('test.xyz', 'application/unknown', 1024);
      
      await act(async () => {
        await result.current.uploadFiles([invalidFile]);
      });

      expect(result.current.error).toBe('File type "application/unknown" is not supported');
      expect(result.current.statusMessage).toContain('Upload failed');
    });
  });

  describe('Security Integration', () => {
    it('should include security context in presign request', async () => {
      const { result } = renderHook(() => useEvidenceUpload());
      
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      
      await act(async () => {
        await result.current.uploadFiles([file], 'recognition-123');
      });

      const presignCall = mockFunctions.createExecution.mock.calls[0];
      const requestData = JSON.parse(presignCall[1]);
      
      expect(requestData).toMatchObject({
        fileName: 'test.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        recognitionId: 'recognition-123'
      });
    });

    it('should handle audit trail creation', async () => {
      const { result } = renderHook(() => useEvidenceUpload());
      
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      
      await act(async () => {
        await result.current.uploadFiles([file]);
      });

      expect(result.current.uploadedFiles[0]).toMatchObject({
        auditId: 'audit-123',
        storageId: 'mock-storage-id'
      });
    });
  });

  describe('Cleanup', () => {
    it('should clear error state on new upload', async () => {
      const { result } = renderHook(() => useEvidenceUpload());
      
      // First upload fails
      mockFunctions.createExecution.mockRejectedValueOnce(
        new Error('First error')
      );
      
      const file1 = createMockFile('test1.jpg', 'image/jpeg', 1024);
      
      await act(async () => {
        await result.current.uploadFiles([file1]);
      });

      expect(result.current.error).toBe('Upload authorization failed: First error');
      
      // Second upload succeeds
      mockFunctions.createExecution.mockResolvedValueOnce({
        responseBody: JSON.stringify({
          uploadToken: 'mock-token',
          storageId: 'mock-storage-id',
          auditId: 'audit-123'
        })
      });
      
      const file2 = createMockFile('test2.jpg', 'image/jpeg', 1024);
      
      await act(async () => {
        await result.current.uploadFiles([file2]);
      });

      expect(result.current.error).toBeNull();
    });

    it('should reset upload state properly', async () => {
      const { result } = renderHook(() => useEvidenceUpload());
      
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      
      await act(async () => {
        await result.current.uploadFiles([file]);
      });

      expect(result.current.uploadedFiles).toHaveLength(1);
      
      act(() => {
        result.current.resetUpload();
      });

      expect(result.current.uploadedFiles).toHaveLength(0);
      expect(result.current.error).toBeNull();
      expect(result.current.statusMessage).toBe('');
    });
  });
});