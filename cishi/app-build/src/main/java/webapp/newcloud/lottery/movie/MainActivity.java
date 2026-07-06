package webapp.newcloud.lottery.movie;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.Base64;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.webkit.JavascriptInterface;
import java.net.HttpURLConnection;
import java.net.IDN;
import java.net.URL;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.Inflater;

public class MainActivity extends Activity {
    private static final String TAG = "MainActivity";
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(0xFF000000);
        }

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF0F172A);
        root.setLayoutParams(new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        webView = new WebView(this);
        FrameLayout.LayoutParams wvLp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT);
        wvLp.gravity = Gravity.CENTER;

        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setAllowContentAccess(true);
        ws.setLoadWithOverviewMode(true);
        ws.setUseWideViewPort(true);
        ws.setBuiltInZoomControls(false);
        ws.setDisplayZoomControls(false);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);
        ws.setDatabaseEnabled(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            ws.setAllowUniversalAccessFromFileURLs(true);
            ws.setAllowFileAccessFromFileURLs(true);
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                        return true;
                    } catch (Exception e) {
                        return false;
                    }
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int progress) {
            }
        });

        webView.addJavascriptInterface(new NativePlayerBridge(), "NativePlayer");
        webView.addJavascriptInterface(new NativeHttpBridge(), "NativeHttp");

        root.addView(webView, wvLp);
        setContentView(root);

        webView.loadUrl("file:///android_asset/assets/index.html");
    }

    private class NativePlayerBridge {
        @JavascriptInterface
        public void play(final String title, final String episodesJson, final String parsersJson, final int startIndex) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent intent = new Intent(MainActivity.this, PlayerActivity.class);
                    intent.putExtra(PlayerActivity.EXTRA_TITLE, title);
                    intent.putExtra(PlayerActivity.EXTRA_EPISODES, episodesJson);
                    intent.putExtra(PlayerActivity.EXTRA_PARSERS, parsersJson);
                    intent.putExtra(PlayerActivity.EXTRA_START_INDEX, startIndex);
                    startActivity(intent);
                }
            });
        }
    }

    private class NativeHttpBridge {
        @JavascriptInterface
        public String httpGet(final String urlStr) {
            return doHttpRequest(urlStr, "GET", null);
        }

        @JavascriptInterface
        public String httpPost(final String urlStr, final String body) {
            return doHttpRequest(urlStr, "POST", body);
        }

        private String doHttpRequest(String urlStr, String method, String body) {
            HttpURLConnection conn = null;
            try {
                String fixedUrl = fixMojibakeUrl(urlStr);
                String idnUrl = encodeIdnUrl(fixedUrl);
                URL url = new URL(idnUrl);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod(method);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Mobile Safari/537.36");
                conn.setRequestProperty("Accept", "*/*");
                conn.setRequestProperty("Accept-Language", "zh-CN,zh;q=0.9");

                if ("POST".equals(method) && body != null) {
                    conn.setDoOutput(true);
                    conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                    conn.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
                }

                int code = conn.getResponseCode();
                InputStream is = (code >= 200 && code < 400) ? conn.getInputStream() : conn.getErrorStream();
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int len;
                while ((len = is.read(buf)) != -1) {
                    baos.write(buf, 0, len);
                }
                is.close();
                byte[] rawData = baos.toByteArray();

                String text = new String(rawData, StandardCharsets.UTF_8);
                String decoded = decodeTvboxData(rawData);
                if (decoded != null && decoded.length() > text.length() / 2) {
                    return decoded;
                }

                if (code < 200 || code >= 400) {
                    return "__ERROR__HTTP " + code + ": " + text;
                }

                return text;
            } catch (Exception e) {
                Log.e(TAG, "NativeHttp error: " + e.getMessage(), e);
                return "__ERROR__" + e.getMessage();
            } finally {
                if (conn != null) conn.disconnect();
            }
        }

        private String fixMojibakeUrl(String urlStr) {
            if (urlStr == null) return null;
            try {
                byte[] raw = urlStr.getBytes("ISO-8859-1");
                String decoded = new String(raw, "UTF-8");
                if (!decoded.equals(urlStr) && decoded.contains("饭太硬")) {
                    return decoded;
                }
            } catch (Exception ignored) {}
            return urlStr;
        }

        private String encodeIdnUrl(String urlStr) {
            if (urlStr == null) return null;
            try {
                String hostPattern = "^(https?://)([^/]+)(.*)$";
                Pattern p = Pattern.compile(hostPattern);
                Matcher m = p.matcher(urlStr);
                if (m.matches()) {
                    String scheme = m.group(1);
                    String host = m.group(2);
                    String path = m.group(3);
                    if (host != null && host.matches(".*[^\\x00-\\x7F].*")) {
                        String asciiHost = IDN.toASCII(host);
                        return scheme + asciiHost + path;
                    }
                }
            } catch (Exception ignored) {}
            return urlStr;
        }

        private String decodeTvboxData(byte[] rawData) {
            try {
                String text = new String(rawData, StandardCharsets.UTF_8);
                Pattern b64Pattern = Pattern.compile("[A-Za-z0-9+/]{200,}={0,2}");
                Matcher matcher = b64Pattern.matcher(text);
                if (matcher.find()) {
                    String b64 = matcher.group(0);
                    try {
                        byte[] decoded = Base64.decode(b64, Base64.DEFAULT);
                        String jsonStr = new String(decoded, StandardCharsets.UTF_8);
                        if (jsonStr.trim().startsWith("{") || jsonStr.trim().startsWith("[")) {
                            return jsonStr;
                        }
                        try {
                            Inflater inflater = new Inflater();
                            inflater.setInput(decoded);
                            byte[] result = new byte[decoded.length * 5];
                            int resultLength = inflater.inflate(result);
                            inflater.end();
                            String zlibStr = new String(result, 0, resultLength, StandardCharsets.UTF_8);
                            if (zlibStr.trim().startsWith("{") || zlibStr.trim().startsWith("[")) {
                                return zlibStr;
                            }
                        } catch (Exception ignored) {}
                    } catch (Exception ignored) {}
                }
            } catch (Exception ignored) {}
            return null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.removeAllViews();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
