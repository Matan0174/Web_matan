package expo.modules.apphandoff

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Opens a web address in the app installed for it (Facebook, YouTube, ...),
 * the way Chrome steps aside for an app that owns a link.
 *
 * Synchronous on purpose: onShouldStartLoadWithRequest must answer at once,
 * and only the launch attempt itself can tell whether an app took the link.
 */
class AppHandoffModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AppHandoff")

    Function("openInApp") { url: String ->
      openInApp(url)
    }
  }

  private fun openInApp(url: String): Boolean {
    val context: Context = appContext.currentActivity ?: appContext.reactContext ?: return false
    val uri = Uri.parse(url)
    val scheme = uri.scheme?.lowercase()
    if (scheme != "http" && scheme != "https") return false

    val intent = Intent(Intent.ACTION_VIEW, uri)
      .addCategory(Intent.CATEGORY_BROWSABLE)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      // The system throws instead of falling back to a browser (this one included),
      // and on Android 12+ it also skips apps whose link ownership is unverified.
      intent.addFlags(Intent.FLAG_ACTIVITY_REQUIRE_NON_BROWSER)
    } else {
      val handlers = specializedHandlers(context, intent)
      if (handlers.isEmpty()) return false
      if (handlers.size == 1) intent.setPackage(handlers[0])
    }

    return try {
      context.startActivity(intent)
      true
    } catch (e: Exception) {
      false
    }
  }

  /** Apps whose filter names a host or path — a browser's filter names only the scheme. */
  @Suppress("DEPRECATION")
  private fun specializedHandlers(context: Context, intent: Intent): List<String> =
    context.packageManager
      .queryIntentActivities(intent, PackageManager.GET_RESOLVED_FILTER)
      .filter { info ->
        val filter = info.filter
        filter != null &&
          info.activityInfo.packageName != context.packageName &&
          (filter.countDataAuthorities() > 0 || filter.countDataPaths() > 0)
      }
      .map { it.activityInfo.packageName }
      .distinct()
}
