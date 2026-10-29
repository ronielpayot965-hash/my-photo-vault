
import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

// Replace these with your own Supabase values.
const SUPABASE_URL = "https://hzadambqtrtefuyejrit.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_2fA72GckPgyv-Qw-ljIB0Q_fH9pDeDn";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const authForm = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const authMessage = document.getElementById("auth-message");
const signupButton = document.getElementById("signup-btn");
const logoutButton = document.getElementById("logout-btn");
const uploadInput = document.getElementById("photo-input");
const gallery = document.getElementById("gallery");
const photoCount = document.getElementById("photo-count");

function showMessage(message) {
  authMessage.textContent = message;
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const { error } = await supabase.auth.signInWithPassword({
    email: emailInput.value.trim(),
    password: passwordInput.value
  });

  if (error) {
    showMessage(error.message);
    return;
  }

  showMessage("Signed in successfully!");
  await refreshGallery();
});

signupButton.addEventListener("click", async () => {
  const { data, error } = await supabase.auth.signUp({
    email: emailInput.value.trim(),
    password: passwordInput.value
  });

  if (error) {
    showMessage(error.message);
    return;
  }

  if (!data.session) {
    showMessage(
      "Account created. Check your email to confirm your account."
    );
    return;
  }

  showMessage("Account created successfully!");
  await refreshGallery();
});

logoutButton.addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    showMessage(error.message);
    return;
  }

  gallery.replaceChildren();
  photoCount.textContent = "0 photos";
  showMessage("You have signed out.");
  await updateAuthUI();
});

uploadInput.addEventListener("change", async () => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    showMessage("Please sign in before uploading photos.");
    uploadInput.value = "";
    return;
  }

  for (const file of uploadInput.files) {
    if (!file.type.startsWith("image/")) continue;

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;

    const { error } = await supabase.storage
      .from("photos")
      .upload(path, file, {
        contentType: file.type,
        upsert: false
      });

    if (error) {
      showMessage(`Upload failed: ${error.message}`);
      uploadInput.value = "";
      return;
    }
  }

  uploadInput.value = "";
  showMessage("Upload complete!");
  await refreshGallery();
});

async function refreshGallery() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    gallery.replaceChildren();
    photoCount.textContent = "0 photos";
    return;
  }

  const { data: files, error } = await supabase.storage
    .from("photos")
    .list(user.id, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" }
    });

  if (error) {
    showMessage(`Could not load photos: ${error.message}`);
    return;
  }

  gallery.replaceChildren();

  const photos = (files || []).filter(
    file => file.name && file.id
  );

  photoCount.textContent =
    `${photos.length} photo${photos.length === 1 ? "" : "s"}`;

  if (photos.length === 0) {
    gallery.textContent = "No photos uploaded yet.";
    return;
  }

  for (const file of photos) {
    const path = `${user.id}/${file.name}`;

    const { data: signed, error: urlError } =
      await supabase.storage
        .from("photos")
        .createSignedUrl(path, 60);

    if (urlError) continue;

    const card = document.createElement("div");
    const image = document.createElement("img");
    const download = document.createElement("a");
    const remove = document.createElement("button");

    image.src = signed.signedUrl;
    image.alt = "Your saved photo";
    image.loading = "lazy";
    image.style.width = "100%";
    image.style.borderRadius = "12px";

    download.href = signed.signedUrl;
    download.download = file.name;
    download.textContent = "Download";

    remove.textContent = "Delete";
    remove.type = "button";

    remove.addEventListener("click", async () => {
      if (!confirm("Delete this photo permanently?")) return;

      const { error } = await supabase.storage
        .from("photos")
        .remove([path]);

      if (error) {
        showMessage(`Delete failed: ${error.message}`);
        return;
      }

      showMessage("Photo deleted.");
      await refreshGallery();
    });

    card.append(image, download, remove);
    gallery.append(card);
  }
}

async function updateAuthUI() {
  const { data: { user } } = await supabase.auth.getUser();

  authForm.hidden = Boolean(user);
  signupButton.hidden = Boolean(user);
  logoutButton.hidden = !user;
  uploadInput.disabled = !user;

  if (user) {
    showMessage(`Signed in as ${user.email}`);
  }
}

supabase.auth.onAuthStateChange(() => {
  setTimeout(async () => {
    await updateAuthUI();
    await refreshGallery();
  }, 0);
});

await updateAuthUI();
await refreshGallery();
