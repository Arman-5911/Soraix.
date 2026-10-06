package app.soraix.preview;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.widget.FrameLayout;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.WebViewListener;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private FrameLayout fullscreenHost;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private OnBackPressedCallback fullscreenBack;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        if (bridge == null) return;
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (view, insets) -> {
            int keyboard = insets.isVisible(WindowInsetsCompat.Type.ime())
                ? insets.getInsets(WindowInsetsCompat.Type.ime()).bottom : 0;
            view.setPadding(0, 0, 0, fullscreenHost == null ? keyboard : 0);
            return insets;
        });
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams params = getWindow().getAttributes();
            params.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(params);
        }
        fullscreenBack = new OnBackPressedCallback(false) {
            @Override public void handleOnBackPressed() { closeFullscreen(); }
        };
        getOnBackPressedDispatcher().addCallback(this, fullscreenBack);
        bridge.getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
        bridge.getWebView().setWebChromeClient(new BridgeWebChromeClient(bridge) {
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenHost != null) { callback.onCustomViewHidden(); return; }
                fullscreenCallback = callback;
                fullscreenHost = new FrameLayout(MainActivity.this);
                fullscreenHost.setBackgroundColor(Color.BLACK);
                fullscreenHost.addView(view, new FrameLayout.LayoutParams(-1, -1));
                ((ViewGroup) getWindow().getDecorView()).addView(fullscreenHost, new ViewGroup.LayoutParams(-1, -1));
                fullscreenBack.setEnabled(true);
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                ViewCompat.requestApplyInsets(getWindow().getDecorView());
                immersive();
            }
            @Override public void onHideCustomView() { closeFullscreen(); }
        });
        bridge.addWebViewListener(new WebViewListener() {
            @Override public void onPageLoaded(WebView webView) { applyAppRendering(webView); }
        });
        applyAppRendering(bridge.getWebView());
        immersive();
    }

    private void closeFullscreen() {
        if (fullscreenHost == null) return;
        ((ViewGroup) fullscreenHost.getParent()).removeView(fullscreenHost);
        fullscreenHost.removeAllViews();
        fullscreenHost = null;
        fullscreenBack.setEnabled(false);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WebChromeClient.CustomViewCallback callback = fullscreenCallback;
        fullscreenCallback = null;
        if (callback != null) callback.onCustomViewHidden();
        ViewCompat.requestApplyInsets(getWindow().getDecorView());
        immersive();
    }

    private void immersive() {
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        bars.hide(WindowInsetsCompat.Type.systemBars());
    }

    @Override public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused) immersive();
    }

    private void applyAppRendering(WebView webView) {
        // App-only optimization: the deployed website and external iframes are untouched.
        String css = "html[data-theme=glass] body{background:#060910!important;}"
            + "html[data-theme=glass] :is(.header,.universe-header,.subnav,.modal-backdrop,.drawer,.drawer-modal,.glass-widget,.button,.icon-button,select,.subtitle-panel,.player-episode-controls button){backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}"
            + "html[data-theme=glass] :is(.icon-button,.soraix-brand,.glass-app-icon) svg{filter:none!important;}"
            + "html[data-theme=glass] :is(.anime-card,.universe-card):hover{transform:none!important;}"
            + "html[data-theme=glass] .soraix-letter-x{animation:none!important;}"
            + ".watch-player-session:is(:fullscreen,.player-expanded){padding:0!important;margin:0!important;width:100vw!important;height:100dvh!important;}";
        webView.evaluateJavascript("(()=>{if(location.origin!=='https://soraix.vercel.app')return;let s=document.getElementById('soraix-android-rendering');if(!s){s=document.createElement('style');s.id='soraix-android-rendering';document.head.appendChild(s);}s.textContent=" + JSONObject.quote(css) + ";})()", null);
    }

    @Override public void onDestroy() {
        closeFullscreen();
        super.onDestroy();
    }
}
