import { NativeModules, Platform } from 'react-native';

const normalizeApiUrl = (rawApiUrl: string): string => {
  if (Platform.OS === 'web') {
    return rawApiUrl;
  }

  try {
    const parsedUrl = new URL(rawApiUrl);
    const isLoopbackHost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';

    if (!isLoopbackHost) {
      return rawApiUrl;
    }

    const scriptUrl = NativeModules.SourceCode?.scriptURL as string | undefined;
    const devHost = scriptUrl ? new URL(scriptUrl).hostname : null;
    const resolvedHost = devHost && devHost !== 'localhost' && devHost !== '127.0.0.1'
      ? devHost
      : (Platform.OS === 'android' ? '10.0.2.2' : devHost);

    if (!resolvedHost) {
      return rawApiUrl;
    }

    parsedUrl.hostname = resolvedHost;
    return parsedUrl.toString();
  } catch {
    return rawApiUrl;
  }
};

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error(
    'Missing EXPO_PUBLIC_API_URL. Configure it in a .env file before running the app.'
  );
}

export const config = {
  apiUrl: normalizeApiUrl(apiUrl),
};
