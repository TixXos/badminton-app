import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";

export default function App() {

  // 🔐 LOGIN
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // STATES
  const [players, setPlayers] = useState([]);
  const [name, setName] = useState("");
  const [gender, setGender] = useState("M");
  const [mode, setMode] = useState("simple");
  const [teamMode, setTeamMode] = useState("random");

  const [courts, setCourts] = useState(7);
  const [matches, setMatches] = useState([]);
  const [history, setHistory] = useState([]);

  const [displayMode, setDisplayMode] = useState(false);
  const [showPodium, setShowPodium] = useState(false);

  // 🔐 LOGIN (SSR SAFE)
  const handleLogin = async () => {
    try {
      const { auth } = await import("../lib/firebase");
      const { signInWithEmailAndPassword } = await import("firebase/auth");

      const res = await signInWithEmailAndPassword(auth, email, password);
      setUser(res.user);
    } catch (e) {
      alert("Login failed");
    }
  };

  // FIREBASE SYNC
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "tournament", "main"), (docSnap) => {
      const data = docSnap.data();
      if (data) {
        setPlayers(data.players || []);
        setMatches(data.matches || []);
        setHistory(data.history || []);
      }
    });
    return () => unsub();
  }, []);

  // ADD PLAYER
  const addPlayer = async () => {
    if (!name) return;

    const newPlayers = [
      ...players,
      { name, gender, wins: 0, points: 0, active: true }
    ];

    setPlayers(newPlayers);
    setName("");

    await setDoc(doc(db, "tournament", "main"), {
      players: newPlayers,
      matches,
      history
    });
  };

  // REMOVE PLAYER
  const removePlayer = async (name) => {
    const reason = prompt("Pourquoi ce joueur sort ?");

    const updatedPlayers = players.map(p =>
      p.name === name
        ? { ...p, active: false, reason: reason || "Sorti" }
        : p
    );

    setPlayers(updatedPlayers);

    await setDoc(doc(db, "tournament", "main"), {
      players: updatedPlayers,
      matches,
      history
    });
  };

  // RESET
  const resetTournament = async () => {
    if (!confirm("Reset COMPLET ?")) return;

    setPlayers([]);
    setMatches([]);
    setHistory([]);

    await setDoc(doc(db, "tournament", "main"), {
      players: [],
      matches: [],
      history: []
    });
  };

  const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

  // GENERATE MATCHES
  const generateMatches = () => {
    let newMatches = [];

    const active = shuffle(players.filter(p => p.active));

    // SIMPLE
    if (mode === "simple") {
      for (let i = 0; i < active.length - 1 && newMatches.length < courts; i += 2) {
        newMatches.push({
          p1: active[i].name,
          p2: active[i + 1].name,
          score1: "",
          score2: "",
          validated: false
        });
      }
    }

    // DOUBLE
    if (mode === "double") {
      const pool = teamMode === "random" ? shuffle(active) : active;

      for (let i = 0; i < pool.length - 3 && newMatches.length < courts; i += 4) {
        newMatches.push({
          p1: `${pool[i].name} / ${pool[i + 1].name}`,
          p2: `${pool[i + 2].name} / ${pool[i + 3].name}`,
          score1: "",
          score2: "",
          validated: false
        });
      }
    }

    // MIXTE
    if (mode === "mixte") {
      const men = shuffle(active.filter(p => p.gender === "M"));
      const women = shuffle(active.filter(p => p.gender === "F"));

      for (let i = 0; i < Math.min(men.length, women.length) - 1 && newMatches.length < courts; i += 2) {
        newMatches.push({
          p1: `${men[i].name} / ${women[i].name}`,
          p2: `${men[i + 1].name} / ${women[i + 1].name}`,
          score1: "",
          score2: "",
          validated: false
        });
      }
    }

    setMatches(newMatches);
    return newMatches;
  };

  const handleGenerate = async () => {
    const newMatches = generateMatches();

    await setDoc(doc(db, "tournament", "main"), {
      players,
      matches: newMatches,
      history
    });
  };

  const updateScore = (i, field, val) => {
    const updated = [...matches];
    updated[i][field] = val === "" ? "" : Number(val);
    setMatches(updated);
  };

  const validateMatch = async (i) => {
    const updated = [...matches];
    updated[i].validated = true;

    await setDoc(doc(db, "tournament", "main"), {
      players,
      matches: updated,
      history
    });
  };

  const nextRound = async () => {
    const newHistory = [...history, ...matches];
    const newMatches = generateMatches();

    setHistory(newHistory);
    setMatches(newMatches);

    await setDoc(doc(db, "tournament", "main"), {
      players,
      matches: newMatches,
      history: newHistory
    });
  };

  const allMatchesValidated =
    matches.length > 0 && matches.every(m => m.validated);

  const sortedPlayers = [...players].sort(
    (a, b) => b.wins - a.wins || b.points - a.points
  );

  const podium = sortedPlayers.slice(0, 3);

  // LOGIN BLOCK
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-6 rounded-xl flex flex-col gap-2">
          <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} className="border p-2"/>
          <input type="password" placeholder="Mot de passe" onChange={(e) => setPassword(e.target.value)} className="border p-2"/>
          <button onClick={handleLogin} className="bg-blue-600 text-white p-2 rounded">
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cover bg-center p-6"
      style={{ backgroundImage: "url('/background2.jpg')" }}
    >

      {/* BUTTONS */}
      <button onClick={() => setDisplayMode(!displayMode)}
        className="fixed top-4 left-4 bg-black text-white px-4 py-2 rounded z-50">📺</button>

      <button onClick={resetTournament}
        className="fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded z-50">RESET</button>

      <button onClick={() => setShowPodium(true)}
        className="fixed bottom-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded z-50">🏆 Fin</button>

      {/* PODIUM */}
      {showPodium && (
        <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-center text-center">
          <h1 className="text-5xl mb-10">🏆 Podium</h1>

          <div className="text-3xl text-yellow-400">🥇 {podium[0]?.name}</div>
          <div className="text-2xl text-gray-300">🥈 {podium[1]?.name}</div>
          <div className="text-xl text-orange-400">🥉 {podium[2]?.name}</div>

          <button onClick={() => setShowPodium(false)} className="mt-10 bg-white text-black px-4 py-2 rounded">
            Retour
          </button>
        </div>
      )}

      <div className="bg-black/40 min-h-screen p-6">

        {!displayMode && (

          <>
            <h1 className="text-3xl text-white text-center mb-6 font-bold">🏸 Badminton Party</h1>

            {/* ADD PLAYER */}
            <div className="bg-white p-4 rounded-xl mb-4 flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="border p-2 rounded w-full" placeholder="Nom" />

              <select value={gender} onChange={(e) => setGender(e.target.value)}
                className="border p-2 rounded">
                <option value="M">Homme</option>
                <option value="F">Femme</option>
              </select>

              <button onClick={addPlayer} className="bg-blue-600 text-white px-4 rounded">Ajouter</button>
            </div>

            {/* SETTINGS */}
            <div className="bg-white p-4 rounded-xl mb-4 flex gap-2">
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="border p-2 rounded">
                <option value="simple">Simple</option>
                <option value="double">Double</option>
                <option value="mixte">Mixte</option>
              </select>

              {mode !== "simple" && (
                <select value={teamMode} onChange={(e) => setTeamMode(e.target.value)} className="border p-2 rounded">
                  <option value="random">Random</option>
                  <option value="fixed">Fixe</option>
                </select>
              )}

              <input type="number" value={courts} onChange={(e) => setCourts(Number(e.target.value))}
                className="border p-2 rounded w-20" />

              <button onClick={handleGenerate} className="bg-green-600 text-white px-4 rounded">
                Générer
              </button>
            </div>

            {/* MATCHES */}
            <div className="grid md:grid-cols-2 gap-4">
              {matches.map((m, i) => (
                <div key={i} className="bg-white p-4 rounded-xl shadow flex justify-between">

                  <div>
                    <div className="font-bold">Terrain {i + 1}</div>
                    <div>{m.p1}</div>
                    <div className="text-gray-500">vs</div>
                    <div>{m.p2}</div>
                  </div>

                  <div className="flex gap-2 items-center">
                    <input type="number" value={m.score1 || ""}
                      onChange={(e) => updateScore(i, "score1", e.target.value)}
                      className="w-16 h-12 text-lg font-bold text-center bg-gray-100 border-2 border-gray-400 rounded" />

                    <input type="number" value={m.score2 || ""}
                      onChange={(e) => updateScore(i, "score2", e.target.value)}
                      className="w-16 h-12 text-lg font-bold text-center bg-gray-100 border-2 border-gray-400 rounded" />

                    <button onClick={() => validateMatch(i)} disabled={m.validated}
                      className="bg-green-500 text-white px-2 rounded">
                      {m.validated ? "✔️" : "✅"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={nextRound} disabled={!allMatchesValidated}
              className="mt-4 bg-purple-600 text-white px-4 py-2 rounded">
              Next
            </button>

            {/* CLASSEMENT */}
            <div className="bg-white mt-6 p-4 rounded-xl">
              {sortedPlayers.map((p, i) => (
                <div key={i}
                  className={`flex justify-between ${
                    i === 0 ? "text-yellow-500 font-bold" :
                    i === 1 ? "text-gray-400" :
                    i === 2 ? "text-orange-400" : ""
                  }`}
                >
				<div>
					<span>{p.name}</span>

					{!p.active && (
					<span className="ml-2 text-center text-red-500 text-sm italic">
					({p.reason})
					</span>
					)}
				</div>
					<span>
						{p.wins}V / {p.points} pts
					</span>	

                  {p.active && (
                    <button onClick={() => removePlayer(p.name)} className="text-red-500">❌</button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
		{/* 📺 MODE PROJECTEUR */}
{displayMode && (
  <div className="grid grid-cols-2 gap-6 mt-10">

    {matches.length === 0 ? (
      <div className="text-white text-center col-span-2 text-2xl">
        Aucun match en cours
      </div>
    ) : (
      matches.map((m, i) => (
        <div
          key={i}
          className={`p-10 rounded-2xl text-white ${
            m.validated ? "bg-green-700" : "bg-blue-900"
          }`}
        >
          <div className="text-3xl font-bold mb-4">
            🏸 Terrain {i + 1}
          </div>

          <div className="text-5xl font-bold text-center">
            {m.p1}
          </div>

          <div className="text-3xl text-center my-4">VS</div>

          <div className="text-5xl font-bold text-center">
            {m.p2}
          </div>

          <div className="text-6xl text-center mt-6 font-extrabold">
            {m.score1} - {m.score2}
          </div>
        </div>
      ))
    )}

  </div>
)}

      </div>
    </div>
  );
}