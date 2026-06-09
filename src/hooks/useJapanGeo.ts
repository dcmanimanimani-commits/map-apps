import { useEffect, useState } from 'react';
import type { FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';

export type JapanGeoJSON = FeatureCollection<Geometry, GeoJsonProperties & {
  nam?: string;
  nam_ja?: string;
  id?: number;
}>;

export function useJapanGeo() {
  const [geo, setGeo] = useState<JapanGeoJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/japan.geojson')
      .then((res) => {
        if (!res.ok) throw new Error('地図データの読み込みに失敗しました');
        return res.json();
      })
      .then((data: JapanGeoJSON) => {
        setGeo(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { geo, loading, error };
}
