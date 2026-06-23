import { useEffect, useState } from 'react';
import { APP_CONFIG } from '../config/appConfig.js';

export function useMapsData(mapsUrl = APP_CONFIG.data.mapsUrl) {
  const [state, setState] = useState({
    loading: true,
    maps: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    fetch(mapsUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`maps.json: ${response.status}`);
        return response.json();
      })
      .then((maps) => {
        if (!cancelled) setState({ loading: false, maps, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ loading: false, maps: null, error });
      });

    return () => {
      cancelled = true;
    };
  }, [mapsUrl]);

  return state;
}
