package com.example.dltpredictor;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
    private static final String DLT_URL = "https://caipiao.eastmoney.com/pub/Result/History/dlt/";
    private static final String SSQ_URL = "https://caipiao.eastmoney.com/pub/Result/History/ssq/";
    private static final String UA = "Mozilla/5.0 (Linux; Android) AppleWebKit/537.36";

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        webView.setWebViewClient(new WebViewClient());
        webView.addJavascriptInterface(new AndroidSync(), "AndroidSync");
        webView.loadUrl("file:///android_asset/dlt_prediction_fixed.html");
    }

    public static class AndroidSync {
        @JavascriptInterface
        public String fetchLatest(String kind) {
            String baseUrl = "ssq".equals(kind) ? SSQ_URL : DLT_URL;
            List<Result> results = fetchResults(baseUrl);
            if (results.isEmpty()) {
                return "[]";
            }
            return "[" + results.get(0).toJson() + "]";
        }

        private List<Result> fetchResults(String baseUrl) {
            List<Result> results = new ArrayList<>();
            try {
                URL url = new URL(baseUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestProperty("User-Agent", UA);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);

                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
                StringBuilder html = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    html.append(line).append('\n');
                }
                reader.close();

                Pattern rowPattern = Pattern.compile("<tr>(.*?)</tr>", Pattern.DOTALL);
                Matcher rowMatcher = rowPattern.matcher(html.toString());
                while (rowMatcher.find()) {
                    String row = rowMatcher.group(1);
                    Matcher idMatcher = Pattern.compile("id=(\\d+)").matcher(row);
                    if (!idMatcher.find()) {
                        continue;
                    }
                    String period = idMatcher.group(1);
                    String date = "";
                    Matcher dateMatcher = Pattern.compile("(\\d{4}-\\d{2}-\\d{2})").matcher(row);
                    if (dateMatcher.find()) {
                        date = dateMatcher.group(1);
                    }
                    List<Integer> front = findNumbers(row, "red");
                    List<Integer> back = findNumbers(row, "blue");
                    if (!front.isEmpty() && !back.isEmpty()) {
                        results.add(new Result(period, date, front, back));
                    }
                }
            } catch (Exception ignored) {
            }
            return results;
        }

        private List<Integer> findNumbers(String row, String color) {
            List<Integer> nums = new ArrayList<>();
            Pattern p = Pattern.compile("class=\"[^\"]*" + color + "[^\"]*\">(\\d{2})<");
            Matcher m = p.matcher(row);
            while (m.find()) {
                nums.add(Integer.parseInt(m.group(1)));
            }
            return nums;
        }
    }

    private static class Result {
        final String period;
        final String date;
        final List<Integer> front;
        final List<Integer> back;

        Result(String period, String date, List<Integer> front, List<Integer> back) {
            this.period = period;
            this.date = date;
            this.front = front;
            this.back = back;
        }

        String toJson() {
            return "{\"period\":\"" + esc(period) + "\",\"date\":\"" + esc(date) +
                    "\",\"front\":" + nums(front) + ",\"back\":" + nums(back) + "}";
        }

        private static String nums(List<Integer> nums) {
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < nums.size(); i++) {
                if (i > 0) {
                    sb.append(',');
                }
                sb.append(nums.get(i));
            }
            sb.append(']');
            return sb.toString();
        }

        private static String esc(String value) {
            return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
        }
    }
}
