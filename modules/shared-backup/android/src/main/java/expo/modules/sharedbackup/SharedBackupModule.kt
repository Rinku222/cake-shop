package expo.modules.sharedbackup

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.DocumentsContract
import androidx.core.content.ContextCompat
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.Serializable

private const val FOLDER_NAME = "Cake Customers"
private const val FILE_NAME = "cake-shop-backup.json"
private const val MIME_TYPE = "application/json"
private const val EXTERNAL_STORAGE_AUTHORITY = "com.android.externalstorage.documents"

/** Document id of the backup folder on the phone's primary storage ("primary:Documents/Cake Customers"). */
private val FOLDER_DOC_ID = "primary:${Environment.DIRECTORY_DOCUMENTS}/$FOLDER_NAME"

class NeedsFolderAccessException :
  CodedException("ERR_NEEDS_FOLDER_ACCESS", "The app needs access to the $FOLDER_NAME folder", null)

class WrongFolderException :
  CodedException("ERR_WRONG_FOLDER", "Please choose the \"$FOLDER_NAME\" folder inside Documents", null)

/**
 * Keeps one JSON backup in a single fixed folder, Documents/Cake Customers, which survives
 * "Clear data" and uninstalling the app. Nothing outside that folder is ever touched.
 *
 * - While this install created the file, it is read and written directly (no permission).
 * - After "Clear data" or a reinstall, Android no longer lets the app open the old file. The user
 *   then grants access to that one folder via the system folder picker (opened right at it), and
 *   the app keeps using the folder through that grant.
 * - Android 9 and older: plain file access with the legacy storage permission (requested in JS).
 */
class SharedBackupModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private lateinit var folderPicker: AppContextActivityResultLauncher<FolderPickerInput, Uri?>

  override fun definition() = ModuleDefinition {
    Name("SharedBackup")

    Constant("location") { "${Environment.DIRECTORY_DOCUMENTS}/$FOLDER_NAME/$FILE_NAME" }

    RegisterActivityContracts {
      folderPicker = registerForActivityResult(FolderPickerContract())
    }

    /** Whether the backup folder exists on the phone. Checking a folder's existence needs no permission. */
    AsyncFunction("folderExistsAsync") {
      legacyFolder().isDirectory
    }

    AsyncFunction("readAsync") {
      grantedTreeUri()?.let { tree ->
        val fileUri = findFile(tree) ?: return@AsyncFunction null
        return@AsyncFunction context.contentResolver.openInputStream(fileUri)?.use { it.readBytes().toString(Charsets.UTF_8) }
      }
      val file = legacyFile()
      if (!file.exists() && !legacyFolder().isDirectory) return@AsyncFunction null
      try {
        file.readText(Charsets.UTF_8)
      } catch (e: Exception) {
        // The file belongs to an earlier install (or "Clear data" ran): only a folder grant can read it.
        if (file.exists() || legacyFolder().isDirectory) throw NeedsFolderAccessException() else null
      }
    }

    AsyncFunction("writeAsync") { content: String ->
      grantedTreeUri()?.let { tree ->
        val fileUri = findFile(tree) ?: createFile(tree)
        context.contentResolver.openOutputStream(fileUri, "wt")?.use { it.write(content.toByteArray(Charsets.UTF_8)) }
          ?: throw IllegalStateException("Could not open the backup file")
        return@AsyncFunction
      }
      try {
        val file = legacyFile()
        file.parentFile?.mkdirs()
        file.writeText(content, Charsets.UTF_8)
      } catch (e: Exception) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) throw NeedsFolderAccessException()
        throw e
      }
    }

    /**
     * Opens the system folder picker at Documents/Cake Customers so the user can grant access to
     * just that folder. Resolves true when access was granted, false when cancelled.
     */
    AsyncFunction("requestFolderAccessAsync") Coroutine { ->
      legacyFolder().mkdirs()
      val picked = folderPicker.launch(FolderPickerInput(folderTreeUri().toString())) ?: return@Coroutine false
      if (DocumentsContract.getTreeDocumentId(picked) != FOLDER_DOC_ID) {
        releaseGrant(picked)
        throw WrongFolderException()
      }
      true
    }

    /** Android 9 and older use plain file access; JS asks for the storage permission there. */
    Function("needsLegacyPermission") {
      Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && !granted(Manifest.permission.WRITE_EXTERNAL_STORAGE)
    }
  }

  private fun folderTreeUri(): Uri = DocumentsContract.buildTreeDocumentUri(EXTERNAL_STORAGE_AUTHORITY, FOLDER_DOC_ID)

  /** The folder grant from the picker, if the user gave one and it is still valid. */
  private fun grantedTreeUri(): Uri? =
    context.contentResolver.persistedUriPermissions
      .firstOrNull {
        it.isReadPermission && it.isWritePermission &&
          it.uri.authority == EXTERNAL_STORAGE_AUTHORITY &&
          DocumentsContract.getTreeDocumentId(it.uri) == FOLDER_DOC_ID
      }
      ?.uri

  private fun findFile(tree: Uri): Uri? {
    val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
    val projection = arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME)
    context.contentResolver.query(children, projection, null, null, null)?.use { cursor ->
      while (cursor.moveToNext()) {
        if (cursor.getString(1) == FILE_NAME) {
          return DocumentsContract.buildDocumentUriUsingTree(tree, cursor.getString(0))
        }
      }
    }
    return null
  }

  private fun createFile(tree: Uri): Uri {
    val folder = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
    return DocumentsContract.createDocument(context.contentResolver, folder, MIME_TYPE, FILE_NAME)
      ?: throw IllegalStateException("Could not create the backup file")
  }

  private fun releaseGrant(uri: Uri) {
    try {
      context.contentResolver.releasePersistableUriPermission(
        uri,
        Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
      )
    } catch (_: SecurityException) {
    }
  }

  private fun granted(permission: String) =
    ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

  @Suppress("DEPRECATION")
  private fun legacyFolder(): File =
    File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS), FOLDER_NAME)

  private fun legacyFile(): File = File(legacyFolder(), FILE_NAME)

  internal data class FolderPickerInput(val initialUri: String) : Serializable

  /** ACTION_OPEN_DOCUMENT_TREE opened at the backup folder; keeps the granted access across restarts. */
  private inner class FolderPickerContract : AppContextActivityResultContract<FolderPickerInput, Uri?> {
    override fun createIntent(context: Context, input: FolderPickerInput): Intent =
      Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
        putExtra(DocumentsContract.EXTRA_INITIAL_URI, Uri.parse(input.initialUri))
        addFlags(
          Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        )
      }

    override fun parseResult(input: FolderPickerInput, resultCode: Int, intent: Intent?): Uri? {
      val uri = intent?.data
      if (resultCode != Activity.RESULT_OK || uri == null) return null
      context.contentResolver.takePersistableUriPermission(
        uri,
        Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
      )
      return uri
    }
  }
}
