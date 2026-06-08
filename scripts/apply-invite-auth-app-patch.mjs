import fs from "node:fs";

const appPath = "src/App.jsx";
let source = fs.readFileSync(appPath, "utf8");
let changed = false;

function replaceOnce(search, replacement, label) {
  if (source.includes(replacement)) return;
  if (!source.includes(search)) {
    throw new Error(`Could not find App.jsx patch point: ${label}`);
  }
  source = source.replace(search, replacement);
  changed = true;
}

replaceOnce(
  'import LoginScreen from "./components/LoginScreen";',
  'import LoginScreen from "./components/LoginScreen"; import PasswordRecoveryScreen from "./components/PasswordRecoveryScreen";',
  "PasswordRecoveryScreen import"
);

replaceOnce(
  'const [session, setSession] = useState(null);',
  'const [session, setSession] = useState(null); const [passwordRecovery, setPasswordRecovery] = useState(false);',
  "passwordRecovery state"
);

replaceOnce(
  'supabase.auth.onAuthStateChange((_event, session) => { setSession(session);',
  'supabase.auth.onAuthStateChange((event, session) => { setSession(session); if (event === "PASSWORD_RECOVERY") { setPasswordRecovery(true); }',
  "PASSWORD_RECOVERY auth listener"
);

replaceOnce(
  '} if (supabase && !session) { return (  { localStorage.setItem("toner_staff_name", name); setStaff(name); }} /> ); } return (',
  '} if (passwordRecovery) { return ( <PasswordRecoveryScreen onDone={async () => { setPasswordRecovery(false); await supabase.auth.signOut(); }} /> ); } if (supabase && !session) { return (  { localStorage.setItem("toner_staff_name", name); setStaff(name); }} /> ); } return (',
  "password recovery screen render"
);

if (changed) {
  fs.writeFileSync(appPath, source);
  console.log("App.jsx invite-auth patch applied.");
} else {
  console.log("App.jsx already patched.");
}
