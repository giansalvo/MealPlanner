import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://tmamscjybottucghgvxi.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtYW1zY2p5Ym90dHVjZ2hndnhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5NjYzODYsImV4cCI6MjA1OTU0MjM4Nn0.4Ss0cwVXKpWKpKv7MJAu_I1YM7HZ1oQfcLNvJhxqGtc";
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAuth() {
  try {
    const { data, error } = await supabase.auth.getSession();
    const session = data.session;

    const authSection = document.getElementById("authSection");
    const appSection = document.getElementById("appSection");

    console.log("Session:", session);

    if (session && session.user) {
      //authSection.style.display = "none";
      //appSection.style.display = "block";
      authSection.classList.add("hidden");
      appSection.classList.remove("hidden");
      fetchWeeklyPlan(); // opzionale
      await loadUserRecipes();
    } else {
      //authSection.style.display = "block";
      //appSection.style.display = "none";
      authSection.classList.remove("hidden");
      appSection.classList.add("hidden");
    }
  } catch (err) {
    console.error("Errore durante il controllo della sessione:", err.message);
  }
}

/**
 * Helper per ottenere l'ID dell'utente autenticato.
 * Se l'utente non è autenticato, lancia un errore.
 */
async function getUserId() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      throw new Error("Errore nel recupero dell'utente: " + error.message);
    }
    if (!data || !data.user || !data.user.id) {
      throw new Error("Nessun utente autenticato trovato. Effettua il login.");
    }
    return data.user.id;
  } catch (err) {
    console.error("Errore nel recupero dell'ID utente:", err.message);
    throw err;
  }
}

// Funzioni di autenticazione
async function signUp() {
  try {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      alert("Errore: " + error.message);
    } else {
      alert("Registrazione completata! Controlla l'email per la verifica.");
    }
    checkAuth();
  } catch (err) {
    console.error("Errore durante la registrazione:", err.message);
    alert("Errore durante la registrazione: " + err.message);
  }
}

async function signIn() {
  try {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Errore: " + error.message);
    }
    checkAuth();
  } catch (err) {
    console.error("Errore durante il login:", err.message);
    alert("Errore durante il login: " + err.message);
  }
}

document.getElementById("signupBtn").addEventListener("click", signUp);
document.getElementById("signinBtn").addEventListener("click", signIn);

// 1. Creazione Ricetta personalizzata
async function saveRecipe() {
  const user_id = await getUserId();
  const name = document.getElementById("recipeName").value;
  const description = document.getElementById("recipeDescription").value;
  const ingredients = document.getElementById("recipeIngredients").value;
  const protein = parseFloat(document.getElementById("protein").value);
  const carbs = parseFloat(document.getElementById("carbs").value);
  const fats = parseFloat(document.getElementById("fats").value);

  const { data, error } = await supabase
    .from("recipes")
    .insert([{ user_id, name, description, ingredients, protein, carbs, fats }])
    .select();

  if (error) {
    console.error("Errore Supabase:", error);
    alert("Errore nel salvataggio della ricetta: " + error.message);
  } else {
    console.log("Ricetta salvata:", data);
    const recipeId = Array.isArray(data) ? data[0]?.id : data?.id;

    if (recipeId) {
      alert("Ricetta salvata con successo!\nID: " + recipeId);
    } else {
      alert("Ricetta salvata, ma ID non disponibile");
    }
  }
  await loadUserRecipes();
}
document.getElementById("saveRecipeBtn").addEventListener("click", saveRecipe);

// 2. Aggiungere ricetta al piano settimanale
async function addToWeeklyPlan() {
  try {
    const user_id = await getUserId();
    const day_of_week = document.getElementById("planDay").value;
    const meal_time = document.getElementById("mealTime").value;
    const recipe_id = document.getElementById("planRecipeSelect").value;
    const { data, error } = await supabase
      .from("weekly_plan")
      .insert([{ user_id, day_of_week, meal_time, recipe_id }]);

    console.log("addToWeeklyPlan:", data, error);
    if (error) {
      alert("Errore nell'aggiunta al piano: " + error.message);
    } else {
      // alert("Ricetta aggiunta al piano settimanale!");
      fetchWeeklyPlan();
    }
  } catch (err) {
    alert(err.message);
  }
}

document
  .getElementById("addPlanBtn")
  .addEventListener("click", addToWeeklyPlan);

// Visualizzare il piano settimanale
async function fetchWeeklyPlan() {
  try {
    const user_id = await getUserId();
    const { data, error } = await supabase
      .from("weekly_plan")
      .select(
        `
                          day_of_week,
                          meal_time,
                          recipe:recipes ( name, ingredients, protein, carbs, fats )
                        `,
      )
      .eq("user_id", user_id);

    if (error) {
      document.getElementById("planResults").innerText =
        "Errore: " + error.message;
      return;
    }

    let html = "";
    data.forEach((plan) => {
      html += `<p>${plan.day_of_week} - ${plan.meal_time}: ${plan.recipe ? plan.recipe.name : "Nessuna ricetta"} </p>`;
    });
    document.getElementById("planResults").innerHTML = html;
  } catch (err) {
    document.getElementById("planResults").innerText = err.message;
  }
}

// 3. Calcolare i macro totali per giorno/settimana
async function calcMacros() {
  try {
    const user_id = await getUserId();
    const { data, error } = await supabase
      .from("weekly_plan")
      .select(
        `
                          recipe:recipes ( protein, carbs, fats )
                        `,
      )
      .eq("user_id", user_id);

    if (error) {
      document.getElementById("macroResults").innerText =
        "Errore: " + error.message;
      return;
    }

    let totalProtein = 0,
      totalCarbs = 0,
      totalFats = 0;
    data.forEach((plan) => {
      if (plan.recipe) {
        totalProtein += parseFloat(plan.recipe.protein) || 0;
        totalCarbs += parseFloat(plan.recipe.carbs) || 0;
        totalFats += parseFloat(plan.recipe.fats) || 0;
      }
    });

    document.getElementById("macroResults").innerText =
      `Proteine totali: ${totalProtein}g, Carboidrati totali: ${totalCarbs}g, Grassi totali: ${totalFats}g`;
  } catch (err) {
    document.getElementById("macroResults").innerText = err.message;
  }
}

async function loadUserRecipes() {
  try {
    const user_id = await getUserId();

    const { data, error } = await supabase
      .from("recipes")
      .select("id, name")
      .eq("user_id", user_id);

    if (error) {
      console.error("Errore nel recupero ricette:", error);
      return;
    }

    const select = document.getElementById("planRecipeSelect");
    select.innerHTML = '<option value="">Seleziona una ricetta</option>';

    data.forEach((recipe) => {
      const option = document.createElement("option");
      option.value = recipe.id;
      option.textContent = recipe.name;
      select.appendChild(option);
    });
  } catch (err) {
    console.error("Errore:", err.message);
  }
}

// Funzione di logout
async function logoutUser() {
  try {
    // Logga l'utente con Supabase
    await supabase.auth.signOut();

    // Nascondi la sezione dell'app e mostra la sezione di autenticazione
    document.getElementById("appSection").classList.add("hidden");
    document.getElementById("authSection").classList.remove("hidden");

    console.log("Logout effettuato correttamente.");
  } catch (err) {
    console.error("Errore durante il logout:", err.message);
    alert("Errore durante il logout: " + err.message);
  }
  checkAuth();
}

// Assicurati che il bottone di logout esista prima di aggiungere l'event listener
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logoutUser);
  } else {
    console.error("Bottone di logout non trovato.");
  }
});

// 4. Generare la lista della spesa
async function generateShoppingList() {
  const shoppingDiv = document.getElementById("shoppingList");
  shoppingDiv.innerHTML = "Caricamento...";

  try {
    const user_id = await getUserId();

    const { data, error } = await supabase
      .from("weekly_plan")
      .select(
        `
        recipe:recipes ( ingredients )
      `,
      )
      .eq("user_id", user_id);

    if (error) {
      shoppingDiv.innerText = "Errore: " + error.message;
      return;
    }

    const ingredientSet = new Set();

    data.forEach((plan) => {
      const ingredientString = plan?.recipe?.ingredients;
      if (ingredientString) {
        ingredientString
          .split(",")
          .map((ing) => ing.trim())
          .filter((ing) => ing.length > 0)
          .forEach((ing) => ingredientSet.add(ing));
      }
    });

    const ingredientList = Array.from(ingredientSet);

    if (ingredientList.length === 0) {
      shoppingDiv.innerText =
        "Nessun ingrediente trovato nel piano settimanale.";
    } else {
      shoppingDiv.innerHTML =
        "<ul>" + ingredientList.map((i) => `<li>${i}</li>`).join("") + "</ul>";
    }
  } catch (err) {
    shoppingDiv.innerText = "Errore: " + err.message;
  }
}

async function exportShoppingListToWhatsApp() {
  try {
    const user_id = await getUserId(); // Otteniamo l'ID dell'utente
    const { data, error } = await supabase
      .from("recipes") // Tabella delle ricette
      .select("ingredients") // Selezioniamo solo il campo "ingredients"
      .eq("user_id", user_id); // Filtriamo per l'ID dell'utente

    if (error) {
      alert(
        "Errore nel recupero dei dati della lista della spesa: " +
          error.message,
      );
      return;
    }

    // Verifica se ci sono ricette
    if (!data || data.length === 0) {
      alert("Non hai ricette salvate o nessun ingrediente trovato.");
      return;
    }

    // Uniamo gli ingredienti in un unico messaggio
    let shoppingList = "Lista della spesa:\n\n";

    // Itera attraverso le ricette per aggiungere gli ingredienti
    data.forEach((recipe) => {
      if (recipe.ingredients) {
        const ingredients = recipe.ingredients.split(","); // Split separato da virgole
        ingredients.forEach((ingredient) => {
          shoppingList += `- ${ingredient.trim()}\n`; // Aggiungiamo ogni ingrediente alla lista
        });
      }
    });

    // Verifica se la lista della spesa è vuota
    if (shoppingList.trim() === "Lista della spesa:\n\n") {
      alert("Non ci sono ingredienti disponibili per la lista della spesa.");
      return;
    }

    // Creiamo il messaggio precompilato per WhatsApp
    const message = encodeURIComponent(shoppingList);

    // Crea l'URL WhatsApp
    const whatsappUrl = `https://wa.me/?text=${message}`;

    // Apri WhatsApp (può essere WhatsApp Web o l'app mobile)
    window.open(whatsappUrl, "_blank");
  } catch (err) {
    console.error(
      "Errore durante l'esportazione della lista della spesa su WhatsApp:",
      err.message,
    );
  }
}

document
  .getElementById("whatsappExportShoppingListBtn")
  .addEventListener("click", exportShoppingListToWhatsApp);

document.getElementById("logoutBtn").addEventListener("click", logoutUser);

document
  .getElementById("generateShoppingBtn")
  .addEventListener("click", generateShoppingList);

document.getElementById("exportPDF").addEventListener("click", async () => {
  const shoppingListDiv = document.getElementById("shoppingList");
  if (!shoppingListDiv || shoppingListDiv.innerText.trim() === "") {
    alert("Nessuna lista della spesa da esportare.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Lista della Spesa", 10, 20);

  const items = shoppingListDiv.innerText.split("\n");
  items.forEach((item, index) => {
    doc.text(`- ${item}`, 10, 30 + index * 10);
  });

  doc.save("lista_della_spesa.pdf");
});

document.getElementById("calcMacrosBtn").addEventListener("click", calcMacros);

checkAuth();
