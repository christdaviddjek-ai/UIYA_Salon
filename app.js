// ══════════════════════════════════════════════════════════════
//  app.js  –  Logique principale : Firebase + interactions UI
// ══════════════════════════════════════════════════════════════

import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ── Collection Firestore ──────────────────────────────────────
const COLLECTION = "preinscriptions";

// ══════════════════════════════════════════════════════════════
//  MODAL WHATSAPP
// ══════════════════════════════════════════════════════════════

window.openWA = function () {
  document.getElementById("modalWA").classList.add("active");
  document.body.style.overflow = "hidden";
};

window.closeWA = function () {
  document.getElementById("modalWA").classList.remove("active");
  document.body.style.overflow = "";
  document.getElementById("waContent").style.display = "block";
  document.getElementById("waSuccess").classList.remove("active");
};

window.onWAClick = function () {
  setTimeout(function () {
    document.getElementById("waContent").style.display = "none";
    document.getElementById("waSuccess").classList.add("active");
  }, 1500);
};

// ══════════════════════════════════════════════════════════════
//  MODAL PRÉ-INSCRIPTION
// ══════════════════════════════════════════════════════════════

window.openForm = function () {
  document.getElementById("modalForm").classList.add("active");
  document.body.style.overflow = "hidden";
};

window.closeForm = function () {
  document.getElementById("modalForm").classList.remove("active");
  document.body.style.overflow = "";
  document.getElementById("formContent").style.display = "block";
  document.getElementById("formSuccess").classList.remove("active");
  clearForm();
};

window.skipPreinscription = function () {
  showToast("Merci pour votre visite. À bientôt sur l'UIYA.", "success");
};

function clearForm() {
  ["nom", "prenom", "telephone", "etablissement"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = "";
  });
  var f = document.getElementById("filiere");
  var v = document.getElementById("ville");
  if (f) f.value = "";
  if (v) v.value = "";
}

// ══════════════════════════════════════════════════════════════
//  SOUMISSION FORMULAIRE → FIREBASE
// ══════════════════════════════════════════════════════════════

window.submitForm = async function () {
  // Récupération des valeurs
  var nom    = document.getElementById("nom").value.trim();
  var prenom = document.getElementById("prenom").value.trim();
  var tel    = document.getElementById("telephone").value.trim();
  var fil    = document.getElementById("filiere").value;
  var vil    = document.getElementById("ville").value;
  var etab   = document.getElementById("etablissement").value.trim();

  // Validation
  if (!nom || !prenom || !tel || !fil || !vil || !etab) {
    showToast("⚠️ Veuillez remplir tous les champs.", "error");
    return;
  }

  // Désactiver le bouton pendant l'envoi
  var btn = document.querySelector("#formContent .submit-btn");
  btn.disabled    = true;
  btn.textContent = "Envoi en cours…";

  try {
    // ── Écriture dans Firestore ─────────────────────────────
    await addDoc(collection(db, COLLECTION), {
      nom:            nom,
      prenom:         prenom,
      telephone:      tel,
      filiere:        fil,
      ville:          vil,
      etablissement:  etab,
      groupeWA:       false,       // sera mis à true par l'agent
      statut:         "en_attente",
      createdAt:      serverTimestamp()
    });
    // ────────────────────────────────────────────────────────

    // Succès
    document.getElementById("formContent").style.display = "none";
    document.getElementById("formSuccess").classList.add("active");

  } catch (err) {
    console.error("Erreur Firestore :", err);
    showToast("❌ Erreur lors de l'envoi. Réessayez.", "error");
    btn.disabled    = false;
    btn.textContent = "Soumettre ma pré-inscription 🚀";
  }
};

// ══════════════════════════════════════════════════════════════
//  TOAST NOTIFICATION
// ══════════════════════════════════════════════════════════════

function showToast(message, type) {
  var toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent  = message;
  toast.className    = "toast active " + (type || "");
  setTimeout(function () { toast.className = "toast"; }, 3500);
}

// ══════════════════════════════════════════════════════════════
//  FERMETURE MODALS EN CLIQUANT SUR L'OVERLAY
// ══════════════════════════════════════════════════════════════

document.querySelectorAll(".modal-overlay").forEach(function (overlay) {
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) {
      overlay.classList.remove("active");
      document.body.style.overflow = "";
    }
  });
});

// ══════════════════════════════════════════════════════════════
//  ACCESSIBILITÉ CLAVIER SUR LES CARTES
// ══════════════════════════════════════════════════════════════

document.querySelectorAll(".card").forEach(function (card) {
  card.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      card.click();
    }
  });
});
