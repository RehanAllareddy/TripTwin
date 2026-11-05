import type { ComponentType, Ref } from 'react';
import { WebView as RNWebView, type WebViewProps } from 'react-native-webview';

export type { WebViewMessageEvent } from 'react-native-webview';

export interface WebViewHandle {
  injectJavaScript: (script: string) => void;
}

/**
 * react-native-webview declares `WebView<P = undefined>`, and `WebViewProps & undefined`
 * collapses to `never` under current TypeScript. Re-export it with the intended props.
 */
export const WebView = RNWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;
