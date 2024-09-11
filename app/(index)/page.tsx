import { Suspense } from 'react';
import MapClient from './MapClient';

async function getGoogleMapsApiKey(): Promise<string> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Google Maps API key is not set in environment variables');
  }
  return apiKey;
}

export default async function MapPage() {
  try {
    const apiKey = await getGoogleMapsApiKey();

    return (
      <Suspense fallback={<div>Loading map...</div>}>
        <MapClient apiKey={apiKey} />
      </Suspense>
    );
  } catch (error) {
    console.error('Failed to load Google Maps API key:', error);
    return <div>Error: Unable to load map. Please try again later.</div>;
  }
}