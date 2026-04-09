import { useState } from "react";
import { db } from "../lib/firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { useEffect } from "react";

export default function App() {
  const [players, setPlayers] = useState([]);
  const [name, setName] = useState("");
  const [gender, setGender] = useState("M");
  const [courts, setCourts] = useState(7);
  const [matches, setMatches] = useState([]);
  const [history, setHistory] = useState([]);
  const [mode, setMode] = useState("simple");
  const [teamMode, setTeamMode] = useState("random");
  const [displayMode, setDisplayMode] = useState(false);
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
	// Ajout joueur
  const addPlayer = async () => {
	if (!name) return;

	const newPlayers = [
		...players,
		{ name, gender, wins: 0, points: 0, played: 0, active: true }
	];

	setPlayers(newPlayers);
	setName("");

	await setDoc(doc(db, "tournament", "main"), {
		players: newPlayers,
		matches,
		history
	});
};

  const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
  const sortByLeastPlayed = (list) => [...list].sort((a, b) => a.played - b.played);

  // đ„ Anti-doublons stats
  const getHistoryStats = () => {
    const teammates = {};
    const opponents = {};
    const allMatches = [...history.flat(), ...matches];

    allMatches.forEach((m) => {
      const p1 = m.p1.split(" / ");
      const p2 = m.p2.split(" / ");

      p1.forEach(a => p1.forEach(b => {
        if (a !== b) {
          teammates[a] = teammates[a] || new Set();
          teammates[a].add(b);
        }
      }));

      p2.forEach(a => p2.forEach(b => {
        if (a !== b) {
          teammates[a] = teammates[a] || new Set();
          teammates[a].add(b);
        }
      }));

      p1.forEach(a => p2.forEach(b => {
        opponents[a] = opponents[a] || new Set();
        opponents[a].add(b);
        opponents[b] = opponents[b] || new Set();
        opponents[b].add(a);
      }));
    });

    return { teammates, opponents };
  };
	//Récp score match
  const getMatchScore = (team1, team2, stats) => {
    let score = 0;
    const { teammates, opponents } = stats;

    team1.forEach(a => team1.forEach(b => {
      if (a !== b && teammates[a]?.has(b)) score += 10;
    }));

    team2.forEach(a => team2.forEach(b => {
      if (a !== b && teammates[a]?.has(b)) score += 10;
    }));

    team1.forEach(a => team2.forEach(b => {
      if (opponents[a]?.has(b)) score += 5;
    }));

    return score;
  };
	//Generer match
  const generateMatches = () => {
    let newMatches = [];
    let sortedPlayers = sortByLeastPlayed(
	players.filter(p => p.active)
	);
    const stats = getHistoryStats();

    if (mode === "simple") {
      let shuffled = shuffle(sortedPlayers);
      for (let i = 0; i < shuffled.length - 1 && newMatches.length < courts; i += 2) {
        newMatches.push({ p1: shuffled[i].name, p2: shuffled[i + 1].name, score1: 0, score2: 0 });
      }
	  
    }

    if (mode === "double") {
      let pool = shuffle(sortedPlayers);

      for (let c = 0; c < courts; c++) {
        let best = null;
        let bestScore = Infinity;

        for (let i = 0; i < 15; i++) {
          const group = shuffle(pool).slice(0, 4);
          let team1 = [group[0].name, group[1].name];
          let team2 = [group[2].name, group[3].name];

          if (teamMode === "random") {
            const g = shuffle(group);
            team1 = [g[0].name, g[1].name];
            team2 = [g[2].name, g[3].name];
          }

          const score = getMatchScore(team1, team2, stats);
          if (score < bestScore) {
            bestScore = score;
            best = { team1, team2 };
          }
        }

        if (best) {
          newMatches.push({
            p1: best.team1.join(" / "),
            p2: best.team2.join(" / "),
            score1: 0,
            score2: 0,
          });
        }
      }
    }

    if (mode === "mixte") {
      const men = sortByLeastPlayed(players.filter(p => p.gender === "M"));
      const women = sortByLeastPlayed(players.filter(p => p.gender === "F"));

      for (let c = 0; c < courts; c++) {
        let best = null;
        let bestScore = Infinity;

        for (let i = 0; i < 15; i++) {
          const m = shuffle(men).slice(0, 2);
          const w = shuffle(women).slice(0, 2);

          let team1 = [m[0].name, w[0].name];
          let team2 = [m[1].name, w[1].name];

          if (teamMode === "random") {
            const ms = shuffle(m);
            const ws = shuffle(w);
            team1 = [ms[0].name, ws[0].name];
            team2 = [ms[1].name, ws[1].name];
          }

          const score = getMatchScore(team1, team2, stats);
          if (score < bestScore) {
            bestScore = score;
            best = { team1, team2 };
          }
        }

        if (best) {
          newMatches.push({
            p1: best.team1.join(" / "),
            p2: best.team2.join(" / "),
            score1: 0,
            score2: 0,
          });
        }
      }
    }

    setMatches(newMatches);
	
	return newMatches;
  };

  const isFinished = (s1, s2) => (s1 >= 21 || s2 >= 21) && Math.abs(s1 - s2) >= 2;

  const recomputeStats = (allMatches) => {
    const winMap = {}, pointMap = {}, playedMap = {};

    players.forEach((p) => {
      winMap[p.name] = 0;
      pointMap[p.name] = 0;
      playedMap[p.name] = 0;
    });

    allMatches.forEach((m) => {
      const p1List = m.p1.split(" / ");
      const p2List = m.p2.split(" / ");

      p1List.forEach((p) => {
        pointMap[p] += m.score1 || 0;
        playedMap[p]++;
      });
      p2List.forEach((p) => {
        pointMap[p] += m.score2 || 0;
        playedMap[p]++;
      });

      if (isFinished(m.score1, m.score2)) {
        if (m.score1 > m.score2) p1List.forEach((p) => winMap[p]++);
        else p2List.forEach((p) => winMap[p]++);
      }
    });

    setPlayers((prev) =>
      prev.map((p) => ({ ...p, wins: winMap[p.name], points: pointMap[p.name], played: playedMap[p.name] }))
    );
  };

  const updateScore = (index, field, value) => {
    const updated = [...matches];
    updated[index][field] = Number(value);
    setMatches(updated);
    recomputeStats([...history.flat(), ...updated]);
  };

	const nextRound = async () => {
		const newHistory = [...history, matches];
		const newMatches = generateMatches();

		setHistory(newHistory);
		setMatches(newMatches);

		await setDoc(doc(db, "tournament", "main"), {
			players,
			matches: newMatches,
			history: newHistory
		});
	};

  const sortedPlayers = [...players].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.points - a.points;
  });
  // Generer match
  const handleGenerate = async () => {
	const newMatches = generateMatches();

	setMatches(newMatches);

	await setDoc(doc(db, "tournament", "main"), {
		players,
		matches: newMatches,
		history
	});
};
	//Validation des match
	const validateMatch = async (index) => {
		const updated = [...matches];
		const match = updated[index];
		
		match.validated = true;

	//  Vérification score badminton
		const s1 = match.score1;
		const s2 = match.score2;

		if (
			!(
			(s1 >= 21 || s2 >= 21) &&
			Math.abs(s1 - s2) >= 2
			)
		) {
			alert("Score invalide");
			return;
		}

  //  Déterminer gagnant
		const winner = s1 > s2 ? match.p1 : match.p2;

  //  Update joueurs
		const updatedPlayers = players.map((p) => {
			if (p.name === winner) {
			return {
				...p,
				wins: p.wins + 1,
				points: p.points + (s1 > s2 ? s1 : s2)
			};
		}
		return p;
		});

		setPlayers(updatedPlayers);

  //  Sauvegarde Firebase
		await setDoc(doc(db, "tournament", "main"), {
			players: updatedPlayers,
			matches: updated,
			history
		});
};
	const allMatchesValidated = matches.length > 0 && matches.every(m => m.validated);	





	//Display management
return (
  <div
    className="min-h-screen bg-cover bg-center p-6"
    style={{ backgroundImage: "url('/background2.jpg')" }}
  >
    <div className="bg-black/40 min-h-screen p-6">

      <h1 className="text-3xl font-bold mb-6 text-center text-white">
        🏸 Badminton Party Montalieu :)
      </h1>

      <div className="bg-white p-4 rounded-xl shadow mb-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom joueur"
          className="border p-2 rounded w-full"
        />

        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="M">Homme</option>
          <option value="F">Femme</option>
        </select>

        <button
          onClick={addPlayer}
          className="bg-blue-600 text-white px-4 rounded"
        >
          Ajouter
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow mb-4 flex gap-2">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="simple">Simple</option>
          <option value="double">Double</option>
          <option value="mixte">Mixte</option>
        </select>

        {mode !== "simple" && (
          <select
            value={teamMode}
            onChange={(e) => setTeamMode(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="random">Random</option>
            <option value="fixed">Fixes</option>
          </select>
        )}

        <input
          type="number"
          value={courts}
          onChange={(e) => setCourts(Number(e.target.value))}
          className="border p-2 rounded w-20"
        />
		
        <button
          onClick={handleGenerate}
          className="bg-green-600 text-white px-4 rounded"
        >
          Générer
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {matches.map((m, i) => (
  <div
    key={i}
    className="bg-white p-4 rounded-xl shadow flex justify-between items-center"
  >
    <div>
      <div className="font-bold">Terrain {i + 1}</div>
      <div>{m.p1}</div>
      <div className="text-sm text-gray-500">vs</div>
      <div>{m.p2}</div>
    </div>

    <div className="flex items-center gap-2">
      <input
        type="number"
        value={m.score1}
        onChange={(e) =>
          updateScore(i, "score1", e.target.value)
        }
        className="w-12 border rounded text-center"
      />
      <span>-</span>
      <input
        type="number"
        value={m.score2}
        onChange={(e) =>
          updateScore(i, "score2", e.target.value)
        }
        className="w-12 border rounded text-center"
      />

      {/*  BOUTON VALIDER */}
<button
	onClick={() => validateMatch(i)}
	disabled={m.validated}
	className={`px-2 rounded text-sm ${
	m.validated ? "bg-gray-400" : "bg-green-500 text-white"
	}`}
>
  {m.validated ? "✔" : "✅"}
</button>
        
    </div>
  </div>
))}
      </div>

	<button
		onClick={nextRound}
		disabled={!allMatchesValidated}
		className={`px-6 py-2 rounded mt-6 ${
		allMatchesValidated
		? "bg-purple-600 text-white"
		: "bg-gray-400 text-gray-700 cursor-not-allowed"
		}`}
		>
		Next
	</button>

      <div className="mt-6 bg-white p-4 rounded-xl shadow">
        <h2 className="font-bold mb-2">Classement</h2>
        {sortedPlayers.map((p, i) => (
		<div key={i} className={`flex justify-between border-b py-1 
		${i === 0 ? "font-bold text-yellow-500" : ""}
		${i === 1 ? "fond-bold text-gray-400" : ""}
		${i === 2 ? "fond-bold text-orange-400" : ""}
		`}>
    <span>{p.name}</span>

    <div className="flex gap-2 items-center">
      <span>{p.wins}V / {p.points} pts</span>

      {p.active ? (
        <button
          onClick={() =>
            setPlayers(prev =>
              prev.map(pl =>
                pl.name === p.name ? { ...pl, active: false } : pl
              )
            )
          }
          className="bg-red-500 text-white px-2 rounded text-sm"
        >
          ❌
        </button>
      ) : (
        <span className="text-gray-400 text-sm">KO/Apéro</span>
      )}
    </div>
  </div>
))}
      </div>

    </div>
  </div>
);
    
}
