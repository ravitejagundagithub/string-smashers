'use client';

import React, { useState, useEffect } from 'react';

// -------------------------------------------------------------
// 1. CONFIGURATION: Your Web App URL & Secret PIN
// -------------------------------------------------------------
const GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzeeTuljPY4YcOTWEfKJf29OLD0GonB4Nqy1NIi_9PzHPyapVz7M0PhVAFR4JkJJ6ywKg/exec';
const ADMIN_PIN =
  'AKfycbzeeTuljPY4YcOTWEfKJf29OLD0GonB4Nqy1NIi_9PzHPyapVz7M0PhVAFR4JkJJ6ywKg'; // Must match ADMIN_SECRET in Google Apps Script

interface Match {
  id: number;
  group: 'A' | 'B' | 'Knockout' | 'SF' | 'Final';
  stage?: string;
  team1: string;
  team2: string;
  s1: number | '';
  s2: number | '';
}

interface TeamStats {
  team: string;
  played: number;
  wins: number;
  losses: number;
  pf: number;
  pa: number;
  pd: number;
  pts: number;
}

const teamsA = [
  'Illango-Siva',
  'Chary-Vishal',
  'Ravi-Chandu',
  'Kurian-Khojema',
  'Sasi-Shibin',
];
const teamsB = [
  'Sanath-Nikhil',
  'Praveen-Vikas',
  'Siddhu-Guru',
  'Karthik-Vijay',
  'Vineeth-Martin',
];

export default function TournamentApp() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeTab, setActiveTab] = useState<
    'group' | 'qf' | 'sf' | 'finals' | 'standings'
  >('group');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const res = await fetch(GOOGLE_SCRIPT_URL);
      const data = await res.json();
      if (Array.isArray(data)) {
        // Map backend column names (Score 1 / Score 2) to frontend props (s1 / s2)
        const formattedData = data.map((m: any) => ({
          ...m,
          s1: m.s1 ?? m['Score 1'] ?? '',
          s2: m.s2 ?? m['Score 2'] ?? '',
        }));
        setMatches(formattedData);
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (GOOGLE_SCRIPT_URL && !GOOGLE_SCRIPT_URL.includes('YOUR_GOOGLE_APPS')) {
      fetchMatches();
    }
  }, []);

  const handleAdminToggle = () => {
    if (isAdmin) {
      setIsAdmin(false);
    } else {
      const pin = prompt('Enter Admin PIN:');
      if (pin === ADMIN_PIN) setIsAdmin(true);
      else if (pin !== null) alert('Incorrect PIN!');
    }
  };

  const handleScoreChange = (id: number, teamNum: 1 | 2, val: string) => {
    if (!isAdmin) return;
    const numVal = val === '' ? '' : Math.max(0, parseInt(val, 10) || 0);
    setMatches((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, [teamNum === 1 ? 's1' : 's2']: numVal } : m
      )
    );
  };

  const saveScoreToSheet = async (match: Match) => {
    if (!isAdmin) return;
    setSavingId(match.id);
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          secret: ADMIN_PIN,
          id: match.id,
          s1: match.s1,
          s2: match.s2,
        }),
      });
    } catch (err) {
      alert('Failed to sync score');
    } finally {
      setSavingId(null);
    }
  };

  // -------------------------------------------------------------
  // DYNAMIC CALCULATIONS (Group Standings & Knockouts)
  // -------------------------------------------------------------
  const getWinner = (
    matchId: number,
    fallbackTeam1: string,
    fallbackTeam2: string
  ) => {
    const m = matches.find((item) => item.id === matchId);
    if (m && m.s1 !== '' && m.s2 !== '' && m.s1 !== null && m.s2 !== null) {
      const score1 = Number(m.s1);
      const score2 = Number(m.s2);

      const t1 = m.team1 && !m.team1.includes('Group') ? m.team1 : fallbackTeam1;
      const t2 = m.team2 && !m.team2.includes('Group') ? m.team2 : fallbackTeam2;

      if (score1 > score2) return t1;
      if (score2 > score1) return t2;
      return t1;
    }
    return fallbackTeam1;
  };

  const getGroupStats = (
    teamList: string[],
    groupName: 'A' | 'B' | 'SF' | 'Knockout' | 'Final'
  ): TeamStats[] => {
    return teamList
      .map((team) => {
        let played = 0,
          wins = 0,
          losses = 0,
          pf = 0,
          pa = 0,
          pts = 0;

        matches
          .filter((m) => {
            if (groupName === 'SF') {
              return (
                m.group === 'SF' ||
                m.group === ('SF Round-Robin' as any) ||
                (m.id >= 23 && m.id <= 28)
              );
            }
            return m.group === groupName;
          })
          .forEach((m) => {
            if (m.s1 !== '' && m.s2 !== '' && m.s1 !== null && m.s2 !== null) {
              const score1 = Number(m.s1);
              const score2 = Number(m.s2);

              let actualTeam1 = m.team1;
              let actualTeam2 = m.team2;

              // Dynamically map teams for SF matches #23-#28
              if (m.id >= 23 && m.id <= 28) {
                const curGroupAStats = teamsA
                  .map((t) => {
                    let p = 0, w = 0, l = 0, f = 0, a = 0, pt = 0;
                    matches.filter((x) => x.group === 'A').forEach((x) => {
                      if (x.s1 !== '' && x.s2 !== '' && x.s1 !== null && x.s2 !== null) {
                        const s1 = Number(x.s1), s2 = Number(x.s2);
                        if (x.team1 === t) {
                          p++; f += s1; a += s2;
                          if (s1 > s2) { w++; pt += 2; } else { l++; if (s1 >= 20) pt += 1; }
                        } else if (x.team2 === t) {
                          p++; f += s2; a += s1;
                          if (s2 > s1) { w++; pt += 2; } else { l++; if (s2 >= 20) pt += 1; }
                        }
                      }
                    });
                    return { team: t, pts: pt, pd: f - a, pf: f };
                  })
                  .sort((a, b) => b.pts - a.pts || b.pd - a.pd || b.pf - a.pf);

                const curGroupBStats = teamsB
                  .map((t) => {
                    let p = 0, w = 0, l = 0, f = 0, a = 0, pt = 0;
                    matches.filter((x) => x.group === 'B').forEach((x) => {
                      if (x.s1 !== '' && x.s2 !== '' && x.s1 !== null && x.s2 !== null) {
                        const s1 = Number(x.s1), s2 = Number(x.s2);
                        if (x.team1 === t) {
                          p++; f += s1; a += s2;
                          if (s1 > s2) { w++; pt += 2; } else { l++; if (s1 >= 20) pt += 1; }
                        } else if (x.team2 === t) {
                          p++; f += s2; a += s1;
                          if (s2 > s1) { w++; pt += 2; } else { l++; if (s2 >= 20) pt += 1; }
                        }
                      }
                    });
                    return { team: t, pts: pt, pd: f - a, pf: f };
                  })
                  .sort((a, b) => b.pts - a.pts || b.pd - a.pd || b.pf - a.pf);

                const tA1 = curGroupAStats[0]?.team || 'A1';
                const tA2 = curGroupAStats[1]?.team || 'A2';
                const tA3 = curGroupAStats[2]?.team || 'A3';

                const tB1 = curGroupBStats[0]?.team || 'B1';
                const tB2 = curGroupBStats[1]?.team || 'B2';
                const tB3 = curGroupBStats[2]?.team || 'B3';

                const wQF1 = getWinner(21, tA2, tB3);
                const wQF2 = getWinner(22, tB2, tA3);

                const sfMap: Record<number, { t1: string; t2: string }> = {
                  23: { t1: tA1, t2: tB1 },
                  24: { t1: wQF1, t2: wQF2 },
                  25: { t1: tA1, t2: wQF1 },
                  26: { t1: tB1, t2: wQF2 },
                  27: { t1: tA1, t2: wQF2 },
                  28: { t1: tB1, t2: wQF1 },
                };

                if (sfMap[m.id]) {
                  actualTeam1 = sfMap[m.id].t1;
                  actualTeam2 = sfMap[m.id].t2;
                }
              }

              if (actualTeam1 === team) {
                played++;
                pf += score1;
                pa += score2;
                if (score1 > score2) {
                  wins++;
                  pts += 2;
                } else {
                  losses++;
                  if (score1 >= 20) pts += 1;
                }
              } else if (actualTeam2 === team) {
                played++;
                pf += score2;
                pa += score1;
                if (score2 > score1) {
                  wins++;
                  pts += 2;
                } else {
                  losses++;
                  if (score2 >= 20) pts += 1;
                }
              }
            }
          });
        return { team, played, wins, losses, pf, pa, pd: pf - pa, pts };
      })
      .sort((a, b) => b.pts - a.pts || b.pd - a.pd || b.pf - a.pf);
  };

  const groupAStats = getGroupStats(teamsA, 'A');
  const groupBStats = getGroupStats(teamsB, 'B');

  // Dynamic Knockout Resolution
  const teamA1 = groupAStats[0]?.team || 'A1 (Group A #1)';
  const teamA2 = groupAStats[1]?.team || 'A2 (Group A #2)';
  const teamA3 = groupAStats[2]?.team || 'A3 (Group A #3)';

  const teamB1 = groupBStats[0]?.team || 'B1 (Group B #1)';
  const teamB2 = groupBStats[1]?.team || 'B2 (Group B #2)';
  const teamB3 = groupBStats[2]?.team || 'B3 (Group B #3)';

  const winnerQF1 = getWinner(21, teamA2, teamB3);
  const winnerQF2 = getWinner(22, teamB2, teamA3);

  // Semi-Final Round Robin Teams
  const sfTeams = [teamA1, teamB1, winnerQF1, winnerQF2];

  const sfStats = getGroupStats(sfTeams, 'SF');
  const finalist1 = sfStats[0]?.team || 'SF Rank 1';
  const finalist2 = sfStats[1]?.team || 'SF Rank 2';

  return (
    <div className="bg-slate-900 text-slate-100 min-h-screen p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center border-b border-slate-700 pb-6 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-amber-400">
              STRING SMASHERS 2026
            </h1>
            <p className="text-slate-400 text-sm">
              Live Tournament System (Google Sheets Integrated)
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={fetchMatches}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold border border-slate-600"
            >
              🔄 Sync Scores
            </button>
            <button
              onClick={handleAdminToggle}
              className={`px-4 py-2 rounded-lg font-semibold text-sm border ${
                isAdmin
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500'
                  : 'bg-slate-800 text-slate-300 border-slate-600'
              }`}
            >
              {isAdmin ? '🔓 Admin Active' : '🔒 Admin Login'}
            </button>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap justify-center gap-2 md:gap-4">
          {[
            { id: 'group', label: '1. Group Stage' },
            { id: 'qf', label: '2. Quarter-Finals' },
            { id: 'sf', label: '3. Semi-Finals (RR)' },
            { id: 'finals', label: '4. Finals (Best of 3)' },
            { id: 'standings', label: '📊 All Tables' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-12 text-slate-400">
            <p className="animate-pulse">
              Loading live tournament structure...
            </p>
          </div>
        )}

        {/* TAB 1: GROUP STAGE */}
        {!loading && activeTab === 'group' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-amber-400 border-b border-slate-700 pb-2">
              Group Stage Matches (21 Points Each)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matches
                .filter((m) => m.group === 'A' || m.group === 'B')
                .map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    isAdmin={isAdmin}
                    savingId={savingId}
                    onChange={handleScoreChange}
                    onSave={saveScoreToSheet}
                  />
                ))}
            </div>
          </div>
        )}

        {/* TAB 2: QUARTER-FINALS */}
        {!loading && activeTab === 'qf' && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
              <h2 className="text-2xl font-bold text-amber-400">
                Quarter-Finals (QF)
              </h2>
              <p className="text-xs text-slate-400">
                Single game for 21 points
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-2">
                <span className="text-xs font-bold text-amber-400">
                  QF 1: Group A #2 ({teamA2}) vs Group B #3 ({teamB3})
                </span>
                {(() => {
                  const match21 = matches.find((m) => m.id === 21);
                  return (
                    <MatchCard
                      match={{
                        id: 21,
                        group: 'Knockout',
                        s1: match21?.s1 ?? '',
                        s2: match21?.s2 ?? '',
                        team1: teamA2,
                        team2: teamB3,
                      }}
                      isAdmin={isAdmin}
                      savingId={savingId}
                      onChange={handleScoreChange}
                      onSave={saveScoreToSheet}
                    />
                  );
                })()}
              </div>

              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-2">
                <span className="text-xs font-bold text-amber-400">
                  QF 2: Group B #2 ({teamB2}) vs Group A #3 ({teamA3})
                </span>
                {(() => {
                  const match22 = matches.find((m) => m.id === 22);
                  return (
                    <MatchCard
                      match={{
                        id: 22,
                        group: 'Knockout',
                        s1: match22?.s1 ?? '',
                        s2: match22?.s2 ?? '',
                        team1: teamB2,
                        team2: teamA3,
                      }}
                      isAdmin={isAdmin}
                      savingId={savingId}
                      onChange={handleScoreChange}
                      onSave={saveScoreToSheet}
                    />
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SEMI-FINALS ROUND ROBIN */}
        {!loading && activeTab === 'sf' && (
          <div className="space-y-6">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h2 className="text-2xl font-bold text-amber-400">
                Semi-Finals: 4-Team Round-Robin
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Qualified:{' '}
                <span className="text-amber-300 font-semibold">{teamA1}</span>,{' '}
                <span className="text-amber-300 font-semibold">{teamB1}</span>,{' '}
                <span className="text-amber-300 font-semibold">{winnerQF1}</span>,{' '}
                <span className="text-amber-300 font-semibold">{winnerQF2}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { id: 23, t1: teamA1, t2: teamB1, name: 'Semi-Final M1' },
                { id: 24, t1: winnerQF1, t2: winnerQF2, name: 'Semi-Final M2' },
                { id: 25, t1: teamA1, t2: winnerQF1, name: 'Semi-Final M3' },
                { id: 26, t1: teamB1, t2: winnerQF2, name: 'Semi-Final M4' },
                { id: 27, t1: teamA1, t2: winnerQF2, name: 'Semi-Final M5' },
                { id: 28, t1: teamB1, t2: winnerQF1, name: 'Semi-Final M6' },
              ].map((sf) => {
                const match = matches.find((m) => m.id === sf.id);
                return (
                  <MatchCard
                    key={sf.id}
                    match={{
                      id: sf.id,
                      group: 'SF',
                      stage: sf.name,
                      team1: sf.t1,
                      team2: sf.t2,
                      s1: match?.s1 ?? '',
                      s2: match?.s2 ?? '',
                    }}
                    isAdmin={isAdmin}
                    savingId={savingId}
                    onChange={handleScoreChange}
                    onSave={saveScoreToSheet}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: FINALS */}
        {!loading && activeTab === 'finals' && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="bg-slate-800 p-6 rounded-xl border border-amber-500/50 text-center space-y-2">
              <span className="text-3xl">🏆</span>
              <h2 className="text-3xl font-extrabold text-amber-400">GRAND FINAL</h2>
              <p className="text-sm text-slate-300">
                Best of 3 Games ({finalist1} vs {finalist2})
              </p>
            </div>

            <div className="space-y-4">
              {[29, 30, 31].map((id, index) => {
                const rawMatch = matches.find((m) => m.id === id);
                const match: Match = {
                  id,
                  group: 'Final',
                  stage: rawMatch?.stage || `Final Game ${index + 1}`,
                  team1: finalist1,
                  team2: finalist2,
                  s1: rawMatch?.s1 ?? '',
                  s2: rawMatch?.s2 ?? '',
                };
                return (
                  <div
                    key={id}
                    className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-2"
                  >
                    <span className="text-xs font-bold text-amber-400">
                      Game {index + 1}
                    </span>
                    <MatchCard
                      match={match}
                      isAdmin={isAdmin}
                      savingId={savingId}
                      onChange={handleScoreChange}
                      onSave={saveScoreToSheet}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: STANDINGS TABLES */}
        {!loading && activeTab === 'standings' && (
          <div className="space-y-8">
            {/* Grand Final Summary Table */}
            <div className="bg-slate-800 rounded-xl border border-amber-500/40 p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                  <span>🏆</span> Grand Final Outcome (Best of 3)
                </h2>
                <span className="text-sm text-slate-400 font-semibold">
                  {finalist1} vs {finalist2}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-xs">
                      <th className="p-2">Game</th>
                      <th className="p-2">Matchup</th>
                      <th className="p-2 text-center">Score</th>
                      <th className="p-2 text-right">Game Winner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let f1Wins = 0;
                      let f2Wins = 0;

                      return (
                        <>
                          {[29, 30, 31].map((id, index) => {
                            const m = matches.find((item) => item.id === id);
                            let winner = 'Pending';
                            if (
                              m &&
                              m.s1 !== '' &&
                              m.s2 !== '' &&
                              m.s1 !== null &&
                              m.s2 !== null
                            ) {
                              const s1 = Number(m.s1);
                              const s2 = Number(m.s2);
                              if (s1 > s2) {
                                winner = finalist1;
                                f1Wins++;
                              } else if (s2 > s1) {
                                winner = finalist2;
                                f2Wins++;
                              }
                            }

                            return (
                              <tr key={id} className="border-b border-slate-700/50">
                                <td className="p-2 font-semibold text-slate-400">
                                  Game {index + 1} (Match #{id})
                                </td>
                                <td className="p-2 text-slate-300">
                                  {finalist1} vs {finalist2}
                                </td>
                                <td className="p-2 text-center font-mono text-slate-200">
                                  {m?.s1 !== '' && m?.s1 !== undefined
                                    ? `${m.s1} - ${m.s2}`
                                    : '—'}
                                </td>
                                <td
                                  className={`p-2 text-right font-bold ${
                                    winner !== 'Pending'
                                      ? 'text-amber-400'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {winner}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="bg-slate-900/60 font-bold">
                            <td colSpan={3} className="p-3 text-slate-200">
                              CHAMPION
                            </td>
                            <td className="p-3 text-right text-lg text-amber-400">
                              {f1Wins >= 2
                                ? `🥇 ${finalist1}`
                                : f2Wins >= 2
                                ? `🥇 ${finalist2}`
                                : 'In Progress'}
                            </td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Semi-Finals Outcome */}
            <StandingsTable
              title="Semi-Final Round-Robin Standings (Top 2 to Finals)"
              stats={sfStats}
              color="text-sky-400"
            />
            {/* Quarter-Finals Outcome Summary Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-4">
              <h2 className="text-2xl font-bold text-amber-400">
                Quarter-Finals Outcome
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-xs">
                      <th className="p-2">Match</th>
                      <th className="p-2">Matchup</th>
                      <th className="p-2 text-center">Score</th>
                      <th className="p-2 font-bold text-amber-400">QF Winner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const m21 = matches.find((m) => m.id === 21);
                      const m22 = matches.find((m) => m.id === 22);

                      const qf1Team1 =
                        m21?.team1 && !m21.team1.includes('Group')
                          ? m21.team1
                          : teamA2;
                      const qf1Team2 =
                        m21?.team2 && !m21.team2.includes('Group')
                          ? m21.team2
                          : teamB3;

                      const qf2Team1 =
                        m22?.team1 && !m22.team1.includes('Group')
                          ? m22.team1
                          : teamB2;
                      const qf2Team2 =
                        m22?.team2 && !m22.team2.includes('Group')
                          ? m22.team2
                          : teamA3;

                      return (
                        <>
                          <tr className="border-b border-slate-700/50">
                            <td className="p-2 font-semibold text-slate-400">
                              QF 1 (Match #21)
                            </td>
                            <td className="p-2 text-slate-300">
                              {qf1Team1} vs {qf1Team2}
                            </td>
                            <td className="p-2 text-center font-mono text-slate-200">
                              {m21?.s1 !== '' && m21?.s1 !== undefined
                                ? `${m21.s1} - ${m21.s2}`
                                : 'Pending'}
                            </td>
                            <td className="p-2 font-bold text-amber-400">
                              {winnerQF1}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-700/50">
                            <td className="p-2 font-semibold text-slate-400">
                              QF 2 (Match #22)
                            </td>
                            <td className="p-2 text-slate-300">
                              {qf2Team1} vs {qf2Team2}
                            </td>
                            <td className="p-2 text-center font-mono text-slate-200">
                              {m22?.s1 !== '' && m22?.s1 !== undefined
                                ? `${m22.s1} - ${m22.s2}`
                                : 'Pending'}
                            </td>
                            <td className="p-2 font-bold text-amber-400">
                              {winnerQF2}
                            </td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
            <StandingsTable
              title="Group A Standings"
              stats={groupAStats}
              color="text-amber-400"
            />
            <StandingsTable
              title="Group B Standings"
              stats={groupBStats}
              color="text-emerald-400"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// REUSABLE MATCH CARD & TABLE COMPONENTS
// -------------------------------------------------------------
interface MatchCardProps {
  match: Match;
  isAdmin: boolean;
  savingId: number | null;
  onChange: (id: number, teamNum: 1 | 2, val: string) => void;
  onSave: (match: Match) => void;
}

function MatchCard({
  match,
  isAdmin,
  savingId,
  onChange,
  onSave,
}: MatchCardProps) {
  return (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-between space-y-3">
      <div className="flex justify-between text-xs font-bold text-slate-400">
        <span>Match #{match.id}</span>
        <span>{match.stage || `Group ${match.group}`}</span>
      </div>

      <div className="grid grid-cols-5 items-center gap-2">
        <span className="col-span-2 text-right font-medium text-sm text-slate-200">
          {match.team1}
        </span>

        <div className="flex justify-center gap-1">
          <input
            type="number"
            min="0"
            disabled={!isAdmin || savingId === match.id}
            value={match.s1 ?? ''}
            onChange={(e) => onChange(match.id, 1, e.target.value)}
            onBlur={() => onSave(match)}
            className="w-11 h-9 text-center bg-slate-900 border border-slate-700 text-amber-400 font-bold rounded"
            placeholder="0"
          />
          <input
            type="number"
            min="0"
            disabled={!isAdmin || savingId === match.id}
            value={match.s2 ?? ''}
            onChange={(e) => onChange(match.id, 2, e.target.value)}
            onBlur={() => onSave(match)}
            className="w-11 h-9 text-center bg-slate-900 border border-slate-700 text-amber-400 font-bold rounded"
            placeholder="0"
          />
        </div>

        <span className="col-span-2 text-left font-medium text-sm text-slate-200">
          {match.team2}
        </span>
      </div>
      {savingId === match.id && (
        <span className="text-xs text-amber-400 text-center animate-pulse">
          Syncing...
        </span>
      )}
    </div>
  );
}

interface StandingsTableProps {
  title: string;
  stats: TeamStats[];
  color: string;
}

function StandingsTable({ title, stats, color }: StandingsTableProps) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-4">
      <h2 className={`text-2xl font-bold ${color}`}>{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-sm">
              <th className="p-2">Rank</th>
              <th className="p-2">Team</th>
              <th className="p-2 text-center">Played</th>
              <th className="p-2 text-center">Wins</th>
              <th className="p-2 text-center">Losses</th>
              <th className="p-2 text-center">PF</th>
              <th className="p-2 text-center">PA</th>
              <th className="p-2 text-center">PD</th>
              <th className="p-2 text-center font-bold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, idx) => (
              <tr key={s.team} className="border-b border-slate-700/50">
                <td className="p-2 font-bold text-slate-400">{idx + 1}</td>
                <td className="p-2 font-semibold text-slate-100">{s.team}</td>
                <td className="p-2 text-center">{s.played}</td>
                <td className="p-2 text-center text-emerald-400">{s.wins}</td>
                <td className="p-2 text-center text-rose-400">{s.losses}</td>
                <td className="p-2 text-center">{s.pf}</td>
                <td className="p-2 text-center">{s.pa}</td>
                <td className="p-2 text-center">
                  {s.pd > 0 ? `+${s.pd}` : s.pd}
                </td>
                <td className={`p-2 text-center font-bold text-lg ${color}`}>
                  {s.pts}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
