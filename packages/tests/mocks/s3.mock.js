/**
 * Mock AWS S3 Client for Testing
 * Simulates S3 file storage operations for unit and integration tests
 */

const crypto = require('crypto');

class MockS3 {
  constructor() {
    this.storage = new Map();
    this.metadata = new Map();
  }

  /**
   * Upload a file to mock S3 storage
   * @param {Object} params - Upload parameters
   * @param {string} params.Bucket - S3 bucket name
   * @param {string} params.Key - Object key
   * @param {Buffer} params.Body - File content
   * @param {string} [params.ContentType] - MIME type
   * @param {Record<string, string>} [params.Metadata] - Custom metadata
   * @returns {Promise<Object>} Upload response with ETag, Key, Location
   */
  async upload(params) {
    const key = `${params.Bucket}/${params.Key}`;
    this.storage.set(key, params.Body);
    this.metadata.set(key, {
      size: params.Body.length,
      type: params.ContentType || 'application/octet-stream',
      meta: params.Metadata || {},
      uploadedAt: new Date().toISOString(),
      etag: this.generateETag(params.Body),
    });

    return {
      ETag: this.generateETag(params.Body),
      Key: params.Key,
      Location: `s3://${key}`,
    };
  }

  /**
   * Download a file from mock S3 storage
   * @param {Object} params - Download parameters
   * @param {string} params.Bucket - S3 bucket name
   * @param {string} params.Key - Object key
   * @returns {Promise<Object>} Response with Body buffer
   */
  async download(params) {
    const key = `${params.Bucket}/${params.Key}`;
    const body = this.storage.get(key);
    if (!body) {
      throw new Error(`NoSuchKey: The specified key does not exist: ${key}`);
    }
    return { Body: body };
  }

  /**
   * Delete an object from mock S3 storage
   * @param {Object} params - Delete parameters
   * @param {string} params.Bucket - S3 bucket name
   * @param {string} params.Key - Object key
   */
  async deleteObject(params) {
    const key = `${params.Bucket}/${params.Key}`;
    this.storage.delete(key);
    this.metadata.delete(key);
  }

  /**
   * Stream download from mock S3
   * @param {Object} params - Download parameters
   * @returns {Promise<Object>} Response with async iterable Body
   */
  async getObject(params) {
    const key = `${params.Bucket}/${params.Key}`;
    const body = this.storage.get(key);
    if (!body) {
      throw new Error(`NoSuchKey: The specified key does not exist: ${key}`);
    }
    return {
      Body: (async function* () {
        yield new Uint8Array(body);
      })(),
    };
  }

  /**
   * List objects in mock S3 bucket
   * @param {Object} params - List parameters
   * @param {string} params.Bucket - S3 bucket name
   * @param {string} [params.Prefix] - Key prefix filter
   * @returns {Promise<Object>} Response with Contents array
   */
  async listObjects(params) {
    const prefix = params.Prefix || '';
    const bucketPrefix = `${params.Bucket}/`;
    const keys = Array.from(this.storage.keys())
      .filter((k) => k.startsWith(bucketPrefix) && k.includes(prefix))
      .map((k) => ({
        Key: k.replace(bucketPrefix, ''),
        Size: this.storage.get(k).length,
        LastModified: this.metadata.get(k)?.uploadedAt || new Date().toISOString(),
      }));
    return { Contents: keys };
  }

  /**
   * Check if object exists in mock S3
   * @param {Object} params - Head parameters
   * @param {string} params.Bucket - S3 bucket name
   * @param {string} params.Key - Object key
   * @returns {Promise<Object>} Response with ContentLength and ContentType
   */
  async headObject(params) {
    const key = `${params.Bucket}/${params.Key}`;
    if (!this.storage.has(key)) {
      throw new Error(`NoSuchKey: The specified key does not exist: ${key}`);
    }
    const meta = this.metadata.get(key);
    return {
      ContentLength: meta.size,
      ContentType: meta.type,
    };
  }

  /**
   * Generate mock ETag for file
   * @private
   * @param {Buffer} buffer - File content
   * @returns {string} Mock ETag
   */
  generateETag(buffer) {
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    return `"${hash}"`;
  }

  /**
   * Get metadata for a stored object
   * @param {string} bucket - Bucket name
   * @param {string} key - Object key
   * @returns {Object|undefined} Metadata or undefined
   */
  getMetadata(bucket, key) {
    return this.metadata.get(`${bucket}/${key}`);
  }

  /**
   * Get all stored objects (for testing/debugging)
   * @returns {Array} Array of objects with key, size, and metadata
   */
  getAllObjects() {
    return Array.from(this.storage.entries()).map(([key, buffer]) => ({
      key,
      size: buffer.length,
      metadata: this.metadata.get(key) || {},
    }));
  }

  /**
   * Clear all mock storage (for test cleanup)
   */
  clear() {
    this.storage.clear();
    this.metadata.clear();
  }
}

// Singleton instance for mock S3
const mockS3Instance = new MockS3();

/**
 * Create Jest mock for S3 client
 * @returns {Object} Mocked S3 client
 */
const createMockS3Client = () => {
  return {
    upload: jest.fn((params) => ({
      promise: () => mockS3Instance.upload(params),
    })),
    download: jest.fn((params) => ({
      promise: () => mockS3Instance.download(params),
    })),
    deleteObject: jest.fn((params) => ({
      promise: () => mockS3Instance.deleteObject(params),
    })),
    getObject: jest.fn((params) => ({
      promise: () => mockS3Instance.getObject(params),
    })),
    listObjects: jest.fn((params) => ({
      promise: () => mockS3Instance.listObjects(params),
    })),
    headObject: jest.fn((params) => ({
      promise: () => mockS3Instance.headObject(params),
    })),
  };
};

module.exports = {
  MockS3,
  mockS3Instance,
  createMockS3Client,
};
