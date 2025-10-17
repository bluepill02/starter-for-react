import { useState, useEffect } from 'react';
import { databases } from '../lib/appwrite';

const DATABASE_ID = import.meta.env.VITE_DATABASE_ID || 'main';
const RECOGNITION_COLLECTION_ID = import.meta.env.VITE_RECOGNITION_COLLECTION_ID || 'recognitions';

export function useRecognitions() {
  const [recognitions, setRecognitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchRecognitions() {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch recognitions with pagination and sorting
        const response = await databases.listDocuments(
          DATABASE_ID,
          RECOGNITION_COLLECTION_ID,
          [
            // Only fetch public and team recognitions for feed
            'visibility.notEqual("PRIVATE")',
            // Sort by most recent first
            'createdAt.desc'
          ]
        );

        // Transform the data to match our component expectations
        const transformedRecognitions = response.documents.map(doc => ({
          id: doc.$id,
          giverName: doc.giverName || 'Anonymous', // Fallback if name not available
          recipientName: doc.recipientName || 'Anonymous',
          reason: doc.reason,
          tags: doc.tags || [],
          visibility: doc.visibility,
          createdAt: doc.createdAt,
          weight: doc.weight || 1.0,
          isVerified: doc.verified || false,
          verifierName: doc.verifierName || null,
          evidencePreviewUrl: doc.evidencePreviewUrl || null
        }));

        setRecognitions(transformedRecognitions);
      } catch (err) {
        console.error('Failed to fetch recognitions:', err);
        setError(err.message || 'Failed to load recognitions');
        
        // Fallback to sample data if database is not available
        setRecognitions([
          {
            id: "sample-1",
            giverName: "John Smith",
            recipientName: "Sarah Johnson", 
            reason: "Outstanding leadership during the product launch. Sarah coordinated multiple teams effectively and delivered exceptional results.",
            tags: ["leadership", "teamwork"],
            visibility: "PUBLIC",
            createdAt: "2025-10-16T10:30:00Z",
            weight: 1.7,
            isVerified: true,
            verifierName: "Mike Davis"
          },
          {
            id: "sample-2",
            giverName: "Asha Kumar",
            recipientName: "Ravi Patel",
            reason: "Excellent customer support and calm under pressure during the system outage.",
            tags: ["support", "reliability"],
            visibility: "PUBLIC", 
            createdAt: "2025-10-15T09:12:00Z",
            weight: 1.3,
            isVerified: false
          }
        ]);
      } finally {
        setLoading(false);
      }
    }

    fetchRecognitions();
  }, []);

  return { recognitions, loading, error, refetch: () => setLoading(true) };
}

export function useUserRecognitions(userId) {
  const [recognitions, setRecognitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    async function fetchUserRecognitions() {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch recognitions for a specific user (both given and received)
        const [givenResponse, receivedResponse] = await Promise.all([
          databases.listDocuments(
            DATABASE_ID,
            RECOGNITION_COLLECTION_ID,
            [`giverId.equal("${userId}")`, 'createdAt.desc']
          ),
          databases.listDocuments(
            DATABASE_ID,
            RECOGNITION_COLLECTION_ID,
            [`recipientId.equal("${userId}")`, 'createdAt.desc']
          )
        ]);

        const transformedGiven = givenResponse.documents.map(doc => ({
          ...doc,
          type: 'given',
          id: doc.$id
        }));

        const transformedReceived = receivedResponse.documents.map(doc => ({
          ...doc,
          type: 'received',
          id: doc.$id
        }));

        setRecognitions({
          given: transformedGiven,
          received: transformedReceived,
          total: transformedGiven.length + transformedReceived.length
        });
      } catch (err) {
        console.error('Failed to fetch user recognitions:', err);
        setError(err.message || 'Failed to load user recognitions');
        
        // Fallback to empty data
        setRecognitions({ given: [], received: [], total: 0 });
      } finally {
        setLoading(false);
      }
    }

    fetchUserRecognitions();
  }, [userId]);

  return { recognitions, loading, error };
}