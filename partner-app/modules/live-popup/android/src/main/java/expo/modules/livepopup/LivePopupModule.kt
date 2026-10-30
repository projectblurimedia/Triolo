package expo.modules.livepopup

import android.animation.ValueAnimator
import android.app.KeyguardManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val CHANNEL_ID = "live-requests"
private const val TIMEOUT_MS = 60_000L
private const val BRAND = 0xFF0055D3.toInt()
private const val GREEN = 0xFF16A34A.toInt()

/**
 * A new job or order while the app is closed or in the background, like a ride app's request:
 * - phone unlocked and "Display over other apps" allowed: a card floats over whatever is on
 *   screen (the request, a 60 s timer bar, Later / View / Accept) — not the whole app;
 * - otherwise: a notification whose full-screen intent opens Live Requests over the lock screen.
 * Called from the app's background notification task, so it works with the app closed.
 */
class LivePopupModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw IllegalStateException("No context")

  private val main = Handler(Looper.getMainLooper())
  private var card: View? = null
  private var hideLater: Runnable? = null

  override fun definition() = ModuleDefinition {
    Name("LivePopup")

    /** Android 14+ asks the person to allow full-screen pop-ups for apps like this one. */
    Function("canUseFullScreen") {
      if (Build.VERSION.SDK_INT >= 34) {
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).canUseFullScreenIntent()
      } else {
        true
      }
    }

    /** "Display over other apps": lets the request card float over other apps. */
    Function("canDrawOverlays") {
      if (Build.VERSION.SDK_INT >= 23) Settings.canDrawOverlays(context) else true
    }

    Function("openOverlaySettings") {
      val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    /** Opens the system page where full-screen pop-ups are allowed for this app. */
    Function("openFullScreenSettings") {
      val intent =
        if (Build.VERSION.SDK_INT >= 34) {
          Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${context.packageName}"))
        } else {
          Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    /**
     * id: the request (also the notification's tag); kind: the small label on the card;
     * url: opens Live Requests on this request; the same with "&accept=1" accepts it;
     * labels: the three buttons in the app's language, "Later|View|Accept".
     */
    Function("show") { id: String, kind: String, title: String, body: String, url: String, labels: String ->
      val floating = canFloat()
      postNotification(id, title, body, url, fullScreen = !floating)
      if (floating) main.post { showCard(kind, title, body, url, labels.split("|")) }
    }

    Function("cancel") { id: String ->
      NotificationManagerCompat.from(context).cancel(id, 1)
      main.post { hideCard() }
    }
  }

  /** The card can float only over an unlocked phone, with "Display over other apps" allowed. */
  private fun canFloat(): Boolean {
    if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(context)) return false
    val keyguard = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    return !keyguard.isKeyguardLocked
  }

  private fun openIntent(url: String, code: Int): PendingIntent {
    val open =
      Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
        setPackage(context.packageName)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      }
    return PendingIntent.getActivity(context, code, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun postNotification(id: String, title: String, body: String, url: String, fullScreen: Boolean) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26 && manager.getNotificationChannel(CHANNEL_ID) == null) {
      val channel = NotificationChannel(CHANNEL_ID, "Live requests", NotificationManager.IMPORTANCE_HIGH)
      channel.description = "New jobs and orders"
      channel.enableVibration(true)
      channel.vibrationPattern = longArrayOf(0, 500, 250, 500, 250, 500)
      channel.lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
      manager.createNotificationChannel(channel)
    }
    val pending = openIntent(url, id.hashCode())
    val builder =
      NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(context.applicationInfo.icon)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setCategory(NotificationCompat.CATEGORY_CALL)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setContentIntent(pending)
        .setAutoCancel(true)
        .setTimeoutAfter(TIMEOUT_MS)
        .setColor(BRAND)
    // Locked phone: open Live Requests over the lock screen (the card can't float there).
    if (fullScreen) builder.setFullScreenIntent(pending, true)
    try {
      NotificationManagerCompat.from(context).notify(id, 1, builder.build())
    } catch (_: SecurityException) {
      // Notifications are off for this app.
    }
  }

  private fun dp(value: Float): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, context.resources.displayMetrics).toInt()

  private fun rounded(color: Int, radius: Float, stroke: Int? = null): GradientDrawable =
    GradientDrawable().apply {
      setColor(color)
      cornerRadius = dp(radius).toFloat()
      if (stroke != null) setStroke(dp(1.5f), stroke)
    }

  private fun button(text: String, filled: Int?, textColor: Int, onTap: () -> Unit): TextView =
    TextView(context).apply {
      this.text = text
      gravity = Gravity.CENTER
      setTextColor(textColor)
      setTypeface(typeface, Typeface.BOLD)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
      background = if (filled != null) rounded(filled, 14f) else rounded(Color.WHITE, 14f, 0x33000000)
      setOnClickListener { onTap() }
    }

  private fun showCard(kind: String, title: String, body: String, url: String, labels: List<String>) {
    hideCard()
    val windows = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

    val inner =
      LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(18f), dp(16f), dp(18f), dp(16f))
        background = rounded(Color.WHITE, 24f)
        elevation = dp(12f).toFloat()
      }

    val label =
      TextView(context).apply {
        text = "●  $kind"
        setTextColor(Color.WHITE)
        setTypeface(typeface, Typeface.BOLD)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 11.5f)
        letterSpacing = 0.06f
        background = rounded(BRAND, 999f)
        setPadding(dp(12f), dp(5f), dp(12f), dp(5f))
      }
    inner.addView(label, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))

    val heading =
      TextView(context).apply {
        text = title
        setTextColor(0xFF0F172A.toInt())
        setTypeface(typeface, Typeface.BOLD)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 19f)
        maxLines = 2
        ellipsize = TextUtils.TruncateAt.END
      }
    inner.addView(heading, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(10f) })

    val details =
      TextView(context).apply {
        text = body
        setTextColor(0xFF475569.toInt())
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 14.5f)
        maxLines = 3
        ellipsize = TextUtils.TruncateAt.END
      }
    inner.addView(details, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(4f) })

    // The time left to answer, running down.
    val track = FrameLayout(context).apply { background = rounded(0x1A0055D3, 999f) }
    val bar = View(context).apply { background = rounded(BRAND, 999f) }
    track.addView(bar, FrameLayout.LayoutParams(-1, -1))
    inner.addView(track, LinearLayout.LayoutParams(-1, dp(5f)).apply { topMargin = dp(12f) })

    val row = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
    val open = { link: String ->
      hideCard()
      try {
        openIntent(link, link.hashCode()).send()
      } catch (_: Exception) {
        // Nothing to open.
      }
    }
    row.addView(button(labels.getOrElse(0) { "Later" }, null, 0xFF64748B.toInt()) { hideCard() }, LinearLayout.LayoutParams(0, dp(48f), 1f))
    row.addView(
      button(labels.getOrElse(1) { "View" }, null, BRAND) { open(url) },
      LinearLayout.LayoutParams(0, dp(48f), 1f).apply { leftMargin = dp(8f) },
    )
    row.addView(
      button(labels.getOrElse(2) { "Accept" }, GREEN, Color.WHITE) { open("$url&accept=1") },
      LinearLayout.LayoutParams(0, dp(48f), 1.4f).apply { leftMargin = dp(8f) },
    )
    inner.addView(row, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(14f) })

    val frame = FrameLayout(context).apply { setPadding(dp(14f), dp(14f), dp(14f), dp(28f)) }
    frame.addView(inner, FrameLayout.LayoutParams(-1, -2))

    val params =
      WindowManager.LayoutParams(
        WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.WRAP_CONTENT,
        if (Build.VERSION.SDK_INT >= 26) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else WindowManager.LayoutParams.TYPE_PHONE,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
        PixelFormat.TRANSLUCENT,
      ).apply { gravity = Gravity.BOTTOM }

    try {
      windows.addView(frame, params)
    } catch (_: Exception) {
      return
    }
    card = frame

    // Slides up into place, then the timer runs down; when it ends the card goes.
    frame.translationY = dp(260f).toFloat()
    frame.animate().translationY(0f).setDuration(280).setInterpolator(DecelerateInterpolator()).start()
    bar.pivotX = 0f
    ValueAnimator.ofFloat(1f, 0f).apply {
      duration = TIMEOUT_MS
      interpolator = LinearInterpolator()
      addUpdateListener { bar.scaleX = it.animatedValue as Float }
      start()
    }
    val hide = Runnable { hideCard() }
    hideLater = hide
    main.postDelayed(hide, TIMEOUT_MS)
  }

  private fun hideCard() {
    hideLater?.let { main.removeCallbacks(it) }
    hideLater = null
    val view = card ?: return
    card = null
    try {
      (context.getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(view)
    } catch (_: Exception) {
      // Already gone.
    }
  }
}
