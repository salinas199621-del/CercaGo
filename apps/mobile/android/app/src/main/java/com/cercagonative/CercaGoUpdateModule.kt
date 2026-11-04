package com.cercago.marketplace

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.uimanager.ViewManager
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class CercaGoUpdateModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), ActivityEventListener {

  companion object {
    const val NAME = "CercaGoUpdate"
    private const val PROGRESS_EVENT = "CercaGoUpdateProgress"
    private const val INSTALL_PERMISSION_REQUEST = 8421
    private const val MAX_APK_BYTES = 150L * 1024L * 1024L
  }

  private val executor = Executors.newSingleThreadExecutor()
  private var activePromise: Promise? = null
  private var permissionApk: File? = null

  init {
    context.addActivityEventListener(this)
  }

  override fun getName() = NAME

  @ReactMethod
  fun installUpdate(updateUrl: String, version: String, promise: Promise) {
    if (!version.matches(Regex("""\d+\.\d+\.\d+"""))) {
      promise.reject("INVALID_VERSION", "La versión de la actualización no es válida.")
      return
    }
    val url = try {
      URL(updateUrl).also {
        require(it.protocol == "https" && it.host == "github.com" &&
          it.path.startsWith("/salinas199621-del/CercaGo/releases/")) {
          "El enlace de descarga no pertenece al sitio oficial de CercaGo."
        }
      }
    } catch (error: Exception) {
      promise.reject("INVALID_UPDATE_URL", error.message, error)
      return
    }
    synchronized(this) {
      if (activePromise != null) {
        promise.reject("UPDATE_IN_PROGRESS", "La descarga de la actualización ya está en curso.")
        return
      }
      activePromise = promise
    }

    executor.execute {
      try {
        val apk = downloadUpdate(url, version)
        context.runOnUiQueueThread {
          try {
            prepareInstallation(apk)
          } catch (error: Exception) {
            finishWithError("INSTALLATION_START_FAILED", error.message ?: "No se pudo abrir la instalación.", error)
          }
        }
      } catch (error: Exception) {
        context.runOnUiQueueThread {
          finishWithError("UPDATE_DOWNLOAD_FAILED", error.message ?: "No se pudo descargar la actualización.", error)
        }
      }
    }
  }

  private fun downloadUpdate(url: URL, version: String): File {
    val directory = File(context.cacheDir, "cercago-updates").apply { mkdirs() }
    val apk = File(directory, "CercaGo-$version.apk")
    if (isUpdateApk(apk, version)) {
      emitProgress(apk.length(), apk.length(), "downloading")
      return apk
    }
    apk.delete()
    val temporary = File(directory, "CercaGo-$version.download")
    val connection = (url.openConnection() as HttpURLConnection).apply {
      instanceFollowRedirects = true
      connectTimeout = 30_000
      readTimeout = 30_000
      requestMethod = "GET"
      setRequestProperty("User-Agent", "CercaGo-Android")
      setRequestProperty("Accept", "application/vnd.android.package-archive")
    }
    try {
      val status = connection.responseCode
      require(status in 200..299) { "La descarga respondió con el código $status." }
      require(connection.url.protocol == "https" &&
        connection.url.host in setOf("github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com")) {
        "La descarga no se mantuvo en el sitio seguro de CercaGo."
      }
      val declaredLength = connection.contentLengthLong
      require(declaredLength <= MAX_APK_BYTES) { "El archivo de actualización supera el tamaño permitido." }
      emitProgress(0, declaredLength, "downloading")
      var lastReportedPercent = -1
      var lastReportedAt = System.currentTimeMillis()
      connection.inputStream.use { input ->
        temporary.outputStream().buffered().use { output ->
          val buffer = ByteArray(64 * 1024)
          var total = 0L
          while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            total += count
            require(total <= MAX_APK_BYTES) { "El archivo de actualización supera el tamaño permitido." }
            output.write(buffer, 0, count)
            val percent = if (declaredLength > 0) ((total * 100) / declaredLength).toInt().coerceAtMost(99) else -1
            val now = System.currentTimeMillis()
            if ((percent >= 0 && percent != lastReportedPercent) || now - lastReportedAt >= 250) {
              emitProgress(total, declaredLength, "downloading")
              lastReportedPercent = percent
              lastReportedAt = now
            }
          }
          require(declaredLength <= 0 || total == declaredLength) { "La descarga quedó incompleta." }
        }
      }
      require(isUpdateApk(temporary, version)) {
        "El archivo descargado no es la versión $version de CercaGo. Descarga cancelada."
      }
      emitProgress(temporary.length(), temporary.length(), "downloading")
      require(temporary.renameTo(apk)) { "No se pudo guardar el archivo de actualización." }
      return apk
    } finally {
      connection.disconnect()
      temporary.delete()
    }
  }

  private fun isApk(file: File): Boolean {
    if (!file.isFile || file.length() < 1_000_000L || file.length() > MAX_APK_BYTES) return false
    return file.inputStream().use { input ->
      input.read() == 0x50 && input.read() == 0x4b && input.read() == 0x03 && input.read() == 0x04
    }
  }

  private fun isUpdateApk(file: File, expectedVersion: String): Boolean {
    if (!isApk(file)) return false
    val updateInfo = context.packageManager.getPackageArchiveInfo(file.absolutePath, 0) ?: return false
    if (updateInfo.packageName != context.packageName || updateInfo.versionName != expectedVersion) return false

    val currentInfo = context.packageManager.getPackageInfo(context.packageName, 0)
    val updateVersionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      updateInfo.longVersionCode
    } else {
      updateInfo.versionCode.toLong()
    }
    val currentVersionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      currentInfo.longVersionCode
    } else {
      currentInfo.versionCode.toLong()
    }
    return updateVersionCode > currentVersionCode
  }

  private fun emitProgress(downloadedBytes: Long, totalBytes: Long, phase: String) {
    context.runOnUiQueueThread {
      emitProgressOnUi(downloadedBytes, totalBytes, phase)
    }
  }

  private fun emitProgressOnUi(downloadedBytes: Long, totalBytes: Long, phase: String) {
    val progress = Arguments.createMap().apply {
      putDouble("downloadedBytes", downloadedBytes.toDouble())
      putDouble("totalBytes", totalBytes.coerceAtLeast(0).toDouble())
      putInt("percent", if (totalBytes > 0) ((downloadedBytes * 100) / totalBytes).toInt().coerceIn(0, 100) else -1)
      putString("phase", phase)
    }
    context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(PROGRESS_EVENT, progress)
  }

  private fun prepareInstallation(apk: File) {
    emitProgressOnUi(apk.length(), apk.length(), "installing")
    val activity = context.currentActivity ?: error("Vuelve a CercaGo para continuar con la instalación.")
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
      !context.packageManager.canRequestPackageInstalls()) {
      permissionApk = apk
      val settingsIntent = Intent(
        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
        Uri.parse("package:${context.packageName}"),
      )
      activity.startActivityForResult(settingsIntent, INSTALL_PERMISSION_REQUEST)
      return
    }
    launchInstaller(activity, apk)
  }

  private fun launchInstaller(activity: Activity, apk: File) {
    val uri = FileProvider.getUriForFile(
      context,
      "${context.packageName}.fileprovider",
      apk,
    )
    val installIntent = Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(uri, "application/vnd.android.package-archive")
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    activity.startActivity(installIntent)
    synchronized(this) {
      activePromise?.resolve(null)
      activePromise = null
      permissionApk = null
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != INSTALL_PERMISSION_REQUEST) return
    val apk = permissionApk
    if (apk == null) {
      finishWithError("UPDATE_FILE_MISSING", "Vuelve a descargar la actualización para continuar.")
      return
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
      !context.packageManager.canRequestPackageInstalls()) {
      permissionApk = null
      finishWithError(
        "INSTALL_PERMISSION_REQUIRED",
        "En Ajustes, activa «Permitir desde esta fuente» para CercaGo y vuelve a intentar.",
      )
      return
    }
    try {
      launchInstaller(activity, apk)
    } catch (error: Exception) {
      finishWithError("INSTALLATION_START_FAILED", error.message ?: "No se pudo abrir la instalación.", error)
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  private fun finishWithError(code: String, message: String, error: Throwable? = null) {
    synchronized(this) {
      activePromise?.reject(code, message, error)
      activePromise = null
      permissionApk = null
    }
  }
}

class CercaGoUpdatePackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(CercaGoUpdateModule(context))

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
