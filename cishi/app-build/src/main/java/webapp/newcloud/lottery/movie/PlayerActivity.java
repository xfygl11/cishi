package webapp.newcloud.lottery.movie;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.SeekBar;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.VideoView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class PlayerActivity extends Activity {

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_EPISODES = "episodes";
    public static final String EXTRA_PARSERS = "parsers";
    public static final String EXTRA_START_INDEX = "start_idx";

    private VideoView videoView;
    private TextView titleText;
    private TextView currentTimeText;
    private TextView totalTimeText;
    private SeekBar seekBar;
    private ImageButton playBtn;
    private ImageButton backBtn;
    private ImageButton fullscreenBtn;
    private Button retryBtn;
    private TextView errorText;
    private ProgressBar loadingBar;
    private Spinner speedSpinner;
    private LinearLayout episodesLayout;
    private HorizontalScrollView episodesScroll;
    private LinearLayout parserLayout;
    private FrameLayout controlBar;

    private String title;
    private List<Episode> episodes = new ArrayList<>();
    private List<Parser> parsers = new ArrayList<>();
    private int currentIdx = 0;
    private int currentParserIdx = 0;
    private boolean isPlaying = false;
    private boolean isFullscreen = false;
    private boolean controlVisible = true;
    private int savedPosition = 0;

    private Handler handler = new Handler(Looper.getMainLooper());
    private Runnable hideControlRunnable;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(Color.BLACK);
        }

        parseIntent(getIntent());
        buildUI();
        setupPlayer();
        autoHideControls();
        if (!episodes.isEmpty()) {
            playEpisode(currentIdx);
        }
    }

    private void parseIntent(Intent intent) {
        title = intent.getStringExtra(EXTRA_TITLE);
        if (title == null) title = "播放";
        currentIdx = intent.getIntExtra(EXTRA_START_INDEX, 0);

        String epsJson = intent.getStringExtra(EXTRA_EPISODES);
        if (!TextUtils.isEmpty(epsJson)) {
            try {
                JSONArray arr = new JSONArray(epsJson);
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject obj = arr.optJSONObject(i);
                    if (obj != null) {
                        episodes.add(new Episode(
                                obj.optString("name", "第" + (i + 1) + "集"),
                                obj.optString("url", "")
                        ));
                    }
                }
            } catch (Exception ignored) {}
        }

        String parsersJson = intent.getStringExtra(EXTRA_PARSERS);
        if (!TextUtils.isEmpty(parsersJson)) {
            try {
                JSONArray arr = new JSONArray(parsersJson);
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject obj = arr.optJSONObject(i);
                    if (obj != null) {
                        String base = obj.optString("url", "");
                        if (TextUtils.isEmpty(base)) base = obj.optString("api", "");
                        if (!TextUtils.isEmpty(base)) {
                            parsers.add(new Parser(
                                    obj.optString("name", "解析" + (i + 1)),
                                    base
                            ));
                        }
                    }
                }
            } catch (Exception ignored) {}
        }
    }

    private void buildUI() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        root.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        videoView = new VideoView(this);
        videoView.setId(android.R.id.primary);
        FrameLayout.LayoutParams videoLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT);
        videoLp.gravity = Gravity.CENTER;
        videoView.setBackgroundColor(Color.BLACK);
        root.addView(videoView, videoLp);

        loadingBar = new ProgressBar(this);
        FrameLayout.LayoutParams loadingLp = new FrameLayout.LayoutParams(
                dp(48), dp(48));
        loadingLp.gravity = Gravity.CENTER;
        loadingBar.setVisibility(View.GONE);
        root.addView(loadingBar, loadingLp);

        LinearLayout errorLayout = new LinearLayout(this);
        errorLayout.setOrientation(LinearLayout.VERTICAL);
        errorLayout.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams errLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        errLp.gravity = Gravity.CENTER;
        errorLayout.setVisibility(View.GONE);

        errorText = new TextView(this);
        errorText.setText("播放失败，请切换解析器或剧集");
        errorText.setTextColor(0xFFE0E0E0);
        errorText.setTextSize(14);
        errorText.setGravity(Gravity.CENTER);
        errorLayout.addView(errorText,
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT));

        retryBtn = new Button(this);
        retryBtn.setText("重试");
        retryBtn.setTextColor(Color.WHITE);
        retryBtn.setBackgroundColor(0xFF4AA8FF);
        retryBtn.setAllCaps(false);
        retryBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                retryCurrent();
            }
        });
        LinearLayout.LayoutParams btnLp = new LinearLayout.LayoutParams(dp(120), dp(40));
        btnLp.topMargin = dp(16);
        btnLp.gravity = Gravity.CENTER;
        errorLayout.addView(retryBtn, btnLp);
        root.addView(errorLayout, errLp);
        errorLayout.setTag("error");

        LinearLayout topBar = new LinearLayout(this);
        topBar.setOrientation(LinearLayout.HORIZONTAL);
        topBar.setGravity(Gravity.CENTER_VERTICAL);
        topBar.setBackgroundColor(Color.parseColor("#80000000"));
        topBar.setPadding(dp(12), dp(12), dp(12), dp(12));
        FrameLayout.LayoutParams topLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        topLp.gravity = Gravity.TOP;
        topBar.setTag("topbar");

        backBtn = new ImageButton(this);
        backBtn.setImageResource(android.R.drawable.ic_menu_revert);
        backBtn.setBackground(null);
        backBtn.setPadding(dp(8), dp(8), dp(8), dp(8));
        backBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });
        topBar.addView(backBtn, new LinearLayout.LayoutParams(dp(40), dp(40)));

        titleText = new TextView(this);
        titleText.setText(title);
        titleText.setTextColor(Color.WHITE);
        titleText.setTextSize(16);
        titleText.setMaxLines(1);
        titleText.setEllipsize(TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
                0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
        titleLp.leftMargin = dp(12);
        titleLp.gravity = Gravity.CENTER_VERTICAL;
        topBar.addView(titleText, titleLp);

        fullscreenBtn = new ImageButton(this);
        fullscreenBtn.setImageResource(android.R.drawable.ic_menu_gallery);
        fullscreenBtn.setBackground(null);
        fullscreenBtn.setPadding(dp(8), dp(8), dp(8), dp(8));
        fullscreenBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                toggleFullscreen();
            }
        });
        topBar.addView(fullscreenBtn, new LinearLayout.LayoutParams(dp(40), dp(40)));

        root.addView(topBar, topLp);

        LinearLayout bottomBar = new LinearLayout(this);
        bottomBar.setOrientation(LinearLayout.VERTICAL);
        bottomBar.setBackgroundColor(Color.parseColor("#80000000"));
        bottomBar.setPadding(dp(12), dp(8), dp(12), dp(12));
        FrameLayout.LayoutParams bottomLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        bottomLp.gravity = Gravity.BOTTOM;
        bottomBar.setTag("bottombar");

        LinearLayout progressRow = new LinearLayout(this);
        progressRow.setOrientation(LinearLayout.HORIZONTAL);
        progressRow.setGravity(Gravity.CENTER_VERTICAL);

        currentTimeText = new TextView(this);
        currentTimeText.setText("00:00");
        currentTimeText.setTextColor(Color.WHITE);
        currentTimeText.setTextSize(12);
        progressRow.addView(currentTimeText,
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT));

        seekBar = new SeekBar(this);
        LinearLayout.LayoutParams seekLp = new LinearLayout.LayoutParams(
                0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
        seekLp.leftMargin = dp(8);
        seekLp.rightMargin = dp(8);
        progressRow.addView(seekBar, seekLp);

        totalTimeText = new TextView(this);
        totalTimeText.setText("00:00");
        totalTimeText.setTextColor(Color.WHITE);
        totalTimeText.setTextSize(12);
        progressRow.addView(totalTimeText,
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT));

        bottomBar.addView(progressRow,
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT));

        LinearLayout controlRow = new LinearLayout(this);
        controlRow.setOrientation(LinearLayout.HORIZONTAL);
        controlRow.setGravity(Gravity.CENTER_VERTICAL);
        controlRow.setPadding(0, dp(4), 0, 0);

        playBtn = new ImageButton(this);
        playBtn.setImageResource(android.R.drawable.ic_media_play);
        playBtn.setBackground(null);
        playBtn.setPadding(dp(8), dp(4), dp(8), dp(4));
        playBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                togglePlayPause();
            }
        });
        controlRow.addView(playBtn, new LinearLayout.LayoutParams(dp(48), dp(40)));

        TextView speedLabel = new TextView(this);
        speedLabel.setText("倍速:");
        speedLabel.setTextColor(0xFFA0A0A0);
        speedLabel.setTextSize(12);
        speedLabel.setPadding(dp(12), 0, dp(4), 0);
        controlRow.addView(speedLabel,
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT));

        speedSpinner = new Spinner(this, Spinner.MODE_DROPDOWN);
        String[] speeds = {"0.5x", "1.0x", "1.25x", "1.5x", "2.0x"};
        ArrayAdapter<String> speedAdapter = new ArrayAdapter<>(this,
                android.R.layout.simple_spinner_item, speeds);
        speedAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        speedSpinner.setAdapter(speedAdapter);
        speedSpinner.setSelection(1);
        speedSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                float[] rates = {0.5f, 1.0f, 1.25f, 1.5f, 2.0f};
                setPlaybackSpeed(rates[position]);
            }
            @Override
            public void onNothingSelected(AdapterView<?> parent) {}
        });
        LinearLayout.LayoutParams spinLp = new LinearLayout.LayoutParams(dp(80), dp(36));
        controlRow.addView(speedSpinner, spinLp);

        bottomBar.addView(controlRow,
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT));

        root.addView(bottomBar, bottomLp);

        episodesScroll = new HorizontalScrollView(this);
        episodesScroll.setHorizontalScrollBarEnabled(false);
        FrameLayout.LayoutParams epScrollLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        epScrollLp.gravity = Gravity.BOTTOM;
        epScrollLp.bottomMargin = dp(72);
        episodesLayout = new LinearLayout(this);
        episodesLayout.setOrientation(LinearLayout.HORIZONTAL);
        episodesLayout.setPadding(dp(12), dp(8), dp(12), dp(8));
        episodesScroll.addView(episodesLayout,
                new HorizontalScrollView.LayoutParams(
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(episodesScroll, epScrollLp);

        parserLayout = new LinearLayout(this);
        parserLayout.setOrientation(LinearLayout.HORIZONTAL);
        parserLayout.setGravity(Gravity.CENTER_VERTICAL);
        parserLayout.setPadding(dp(12), dp(6), dp(12), dp(6));
        parserLayout.setBackgroundColor(Color.parseColor("#60000000"));
        FrameLayout.LayoutParams parserLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        parserLp.gravity = Gravity.BOTTOM;
        parserLp.bottomMargin = dp(130);
        parserLayout.setTag("parserbar");
        if (parsers.isEmpty()) {
            parserLayout.setVisibility(View.GONE);
        } else {
            renderParsers();
        }
        root.addView(parserLayout, parserLp);

        controlBar = root;
        setContentView(root);

        videoView.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                toggleControls();
                resetAutoHide();
            }
        });

        renderEpisodes();
    }

    private void renderEpisodes() {
        episodesLayout.removeAllViews();
        for (int i = 0; i < episodes.size(); i++) {
            final int idx = i;
            Episode ep = episodes.get(i);
            Button btn = new Button(this);
            btn.setText(ep.name);
            btn.setTextSize(13);
            btn.setAllCaps(false);
            btn.setMinWidth(dp(72));
            btn.setPadding(dp(12), dp(8), dp(12), dp(8));
            if (idx == currentIdx) {
                btn.setTextColor(Color.WHITE);
                btn.setBackgroundColor(0xFF4AA8FF);
            } else {
                btn.setTextColor(0xFFE0E0E0);
                btn.setBackgroundColor(Color.parseColor("#405A6A"));
            }
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT);
            lp.rightMargin = dp(8);
            btn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    playEpisode(idx);
                    resetAutoHide();
                }
            });
            episodesLayout.addView(btn, lp);
        }
    }

    private void renderParsers() {
        parserLayout.removeAllViews();
        TextView label = new TextView(this);
        label.setText("解析器: ");
        label.setTextColor(0xFFA0A0A0);
        label.setTextSize(12);
        parserLayout.addView(label,
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT));
        for (int i = 0; i < parsers.size(); i++) {
            final int idx = i;
            Parser p = parsers.get(i);
            Button btn = new Button(this);
            btn.setText(p.name);
            btn.setTextSize(12);
            btn.setAllCaps(false);
            btn.setPadding(dp(10), dp(4), dp(10), dp(4));
            if (idx == currentParserIdx) {
                btn.setTextColor(Color.WHITE);
                btn.setBackgroundColor(0xFF2DD4BF);
            } else {
                btn.setTextColor(0xFFE0E0E0);
                btn.setBackgroundColor(Color.parseColor("#3A4A5A"));
            }
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT);
            lp.leftMargin = dp(6);
            btn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    currentParserIdx = idx;
                    renderParsers();
                    retryCurrent();
                }
            });
            parserLayout.addView(btn, lp);
        }
    }

    private void setupPlayer() {
        videoView.setOnPreparedListener(new MediaPlayer.OnPreparedListener() {
            @Override
            public void onPrepared(MediaPlayer mp) {
                loadingBar.setVisibility(View.GONE);
                hideError();
                int duration = videoView.getDuration();
                int current = videoView.getCurrentPosition();
                totalTimeText.setText(formatTime(duration));
                currentTimeText.setText(formatTime(current));
                seekBar.setMax(duration);
                seekBar.setProgress(current);
                if (savedPosition > 0) {
                    videoView.seekTo(savedPosition);
                    savedPosition = 0;
                }
                videoView.start();
                isPlaying = true;
                updatePlayIcon();
                handler.post(progressRunnable);
            }
        });

        videoView.setOnErrorListener(new MediaPlayer.OnErrorListener() {
            @Override
            public boolean onError(MediaPlayer mp, int what, int extra) {
                loadingBar.setVisibility(View.GONE);
                showError();
                isPlaying = false;
                updatePlayIcon();
                return true;
            }
        });

        videoView.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
            @Override
            public void onCompletion(MediaPlayer mp) {
                isPlaying = false;
                updatePlayIcon();
                if (currentIdx + 1 < episodes.size()) {
                    playEpisode(currentIdx + 1);
                }
            }
        });

        seekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                if (fromUser) {
                    currentTimeText.setText(formatTime(progress));
                }
            }
            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {
                handler.removeCallbacks(progressRunnable);
            }
            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {
                videoView.seekTo(seekBar.getProgress());
                handler.post(progressRunnable);
            }
        });
    }

    private void playEpisode(int idx) {
        if (idx < 0 || idx >= episodes.size()) return;
        currentIdx = idx;
        savedPosition = 0;
        Episode ep = episodes.get(idx);
        titleText.setText(title + " · " + ep.name);

        String url = resolvePlayUrl(ep.url, currentParserIdx);
        loadingBar.setVisibility(View.VISIBLE);
        hideError();
        videoView.stopPlayback();
        videoView.setVideoURI(Uri.parse(url));
        seekBar.setProgress(0);
        currentTimeText.setText("00:00");
        totalTimeText.setText("00:00");
        renderEpisodes();

        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                View active = episodesLayout.getChildAt(currentIdx);
                if (active != null) {
                    episodesScroll.smoothScrollTo(active.getLeft() - dp(40), 0);
                }
            }
        }, 100);
    }

    private String resolvePlayUrl(String url, int parserIdx) {
        if (isDirectUrl(url)) return url;
        if (parserIdx >= 0 && parserIdx < parsers.size()) {
            Parser p = parsers.get(parserIdx);
            return p.base + Uri.encode(url);
        }
        return url;
    }

    private boolean isDirectUrl(String url) {
        if (TextUtils.isEmpty(url)) return false;
        String u = url.toLowerCase();
        return u.contains(".m3u8") || u.contains(".mp4") || u.contains(".flv")
                || u.contains(".webm") || u.contains(".mkv") || u.contains(".mov")
                || u.contains("/m3u8/") || u.contains("/play/");
    }

    private void retryCurrent() {
        playEpisode(currentIdx);
    }

    private void togglePlayPause() {
        if (videoView.isPlaying()) {
            videoView.pause();
            isPlaying = false;
        } else {
            videoView.start();
            isPlaying = true;
        }
        updatePlayIcon();
    }

    private void updatePlayIcon() {
        if (isPlaying) {
            playBtn.setImageResource(android.R.drawable.ic_media_pause);
        } else {
            playBtn.setImageResource(android.R.drawable.ic_media_play);
        }
    }

    private void setPlaybackSpeed(float speed) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && videoView != null) {
            try {
                java.lang.reflect.Method getMp = VideoView.class.getDeclaredMethod("getMediaPlayer");
                getMp.setAccessible(true);
                MediaPlayer mp = (MediaPlayer) getMp.invoke(videoView);
                if (mp != null) {
                    android.media.PlaybackParams params = mp.getPlaybackParams();
                    params.setSpeed(speed);
                    mp.setPlaybackParams(params);
                }
            } catch (Exception ignored) {}
        }
    }

    private Runnable progressRunnable = new Runnable() {
        @Override
        public void run() {
            try {
                if (videoView != null && videoView.isPlaying()) {
                    int current = videoView.getCurrentPosition();
                    int total = videoView.getDuration();
                    currentTimeText.setText(formatTime(current));
                    seekBar.setProgress(current);
                    if (total > 0) totalTimeText.setText(formatTime(total));
                }
            } catch (Exception ignored) {}
            handler.postDelayed(this, 1000);
        }
    };

    private void toggleControls() {
        controlVisible = !controlVisible;
        View top = controlBar.findViewWithTag("topbar");
        View bottom = controlBar.findViewWithTag("bottombar");
        View parser = controlBar.findViewWithTag("parserbar");
        if (controlVisible) {
            if (top != null) top.setVisibility(View.VISIBLE);
            if (bottom != null) bottom.setVisibility(View.VISIBLE);
            if (parser != null && !parsers.isEmpty()) parser.setVisibility(View.VISIBLE);
            episodesScroll.setVisibility(View.VISIBLE);
        } else {
            if (top != null) top.setVisibility(View.GONE);
            if (bottom != null) bottom.setVisibility(View.GONE);
            if (parser != null) parser.setVisibility(View.GONE);
            episodesScroll.setVisibility(View.GONE);
        }
    }

    private void autoHideControls() {
        hideControlRunnable = new Runnable() {
            @Override
            public void run() {
                if (isPlaying && controlVisible) {
                    toggleControls();
                }
            }
        };
        resetAutoHide();
    }

    private void resetAutoHide() {
        handler.removeCallbacks(hideControlRunnable);
        handler.postDelayed(hideControlRunnable, 4000);
    }

    private void toggleFullscreen() {
        if (isFullscreen) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (newConfig.orientation == Configuration.ORIENTATION_LANDSCAPE) {
            isFullscreen = true;
            fullscreenBtn.setImageResource(android.R.drawable.ic_menu_close_clear_cancel);
        } else if (newConfig.orientation == Configuration.ORIENTATION_PORTRAIT) {
            isFullscreen = false;
            fullscreenBtn.setImageResource(android.R.drawable.ic_menu_gallery);
        }
    }

    private void showError() {
        View err = controlBar.findViewWithTag("error");
        if (err != null) err.setVisibility(View.VISIBLE);
    }

    private void hideError() {
        View err = controlBar.findViewWithTag("error");
        if (err != null) err.setVisibility(View.GONE);
    }

    private String formatTime(int ms) {
        if (ms <= 0) return "00:00";
        int total = ms / 1000;
        int h = total / 3600;
        int m = (total % 3600) / 60;
        int s = total % 60;
        if (h > 0) {
            return String.format(Locale.CHINA, "%02d:%02d:%02d", h, m, s);
        }
        return String.format(Locale.CHINA, "%02d:%02d", m, s);
    }

    private int dp(int px) {
        return (int) (getResources().getDisplayMetrics().density * px + 0.5);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (isFullscreen) {
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
                return true;
            }
            finish();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (videoView != null && videoView.isPlaying()) {
            videoView.pause();
            isPlaying = false;
            updatePlayIcon();
        }
        handler.removeCallbacks(progressRunnable);
        handler.removeCallbacks(hideControlRunnable);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (videoView != null && savedPosition > 0) {
            videoView.resume();
        }
        handler.post(progressRunnable);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        handler.removeCallbacksAndMessages(null);
        if (videoView != null) {
            videoView.stopPlayback();
            videoView = null;
        }
    }

    private static class Episode {
        String name;
        String url;
        Episode(String name, String url) {
            this.name = name;
            this.url = url;
        }
    }

    private static class Parser {
        String name;
        String base;
        Parser(String name, String base) {
            this.name = name;
            this.base = base;
        }
    }
}
