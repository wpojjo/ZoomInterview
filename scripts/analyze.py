"""
비대칭 vs 대칭 데이터 주입 -- 탐색적 분석
실행: python scripts/analyze.py
"""

import json
from pathlib import Path
from collections import defaultdict

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# 한글 폰트 설정 (Windows)
matplotlib.rc('font', family='Malgun Gothic')
matplotlib.rc('axes', unicode_minus=False)

DATA_PATH = Path(__file__).parent.parent / 'data' / 'experiment-results.jsonl'

# ── 데이터 로드 ───────────────────────────────────────────────────────────

records = []
with open(DATA_PATH, 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line:
            records.append(json.loads(line))

df = pd.DataFrame(records)
print(f'총 레코드: {len(df)}개')

r0 = df[df['round'] == 0].copy()
r1 = df[df['round'] == 1].copy()
print(f'Round 0: {len(r0)}개 / Round 1: {len(r1)}개')
print(f'시나리오: {r0["scenarioId"].unique()}')
print(f'조건:     {r0["condition"].unique()}')

# ── 1. 점수 분포 ──────────────────────────────────────────────────────────

print('\n' + '='*60)
print('1. 조건별 점수 분포')
print('='*60)

score_summary = (
    r0.groupby(['condition', 'agentId'])['score']
    .agg(['mean', 'std', 'count'])
    .round(1)
)
print(score_summary)

fig, axes = plt.subplots(1, 2, figsize=(12, 4))
for ax, scenario_id in zip(axes, r0['scenarioId'].unique()):
    subset = r0[r0['scenarioId'] == scenario_id]
    pivot = subset.pivot_table(index='agentId', columns='condition', values='score')
    pivot.plot(kind='bar', ax=ax, color=['#4C72B0', '#DD8452'], rot=0)
    ax.set_title(scenario_id.replace('scenario_', ''), fontsize=11)
    ax.set_xlabel('에이전트')
    ax.set_ylabel('점수')
    ax.set_ylim(0, 100)
    ax.legend(title='조건')
    ax.axhline(50, linestyle='--', color='gray', alpha=0.5)
plt.suptitle('에이전트별 점수 -- 비대칭 vs 대칭', fontsize=13)
plt.tight_layout()
plt.savefig(DATA_PATH.parent / 'plot_1_scores.png', dpi=150)
print('→ plot_1_scores.png 저장')

# ── 2. 점수 분산 ──────────────────────────────────────────────────────────

print('\n' + '='*60)
print('2. 에이전트 간 점수 분산')
print('='*60)

variance_df = (
    r0.groupby(['scenarioId', 'condition', 'timestamp'])['score']
    .std()
    .reset_index()
    .rename(columns={'score': 'score_std'})
)
summary = variance_df.groupby('condition')['score_std'].agg(['mean', 'std', 'count']).round(2)
print(summary)

asym_std = variance_df[variance_df['condition'] == 'asymmetric']['score_std'].mean()
sym_std  = variance_df[variance_df['condition'] == 'symmetric']['score_std'].mean()
diff = asym_std - sym_std
print(f'\n비대칭 평균 std: {asym_std:.2f} / 대칭 평균 std: {sym_std:.2f}')
print(f'→ 비대칭이 {abs(diff):.2f}점 {"더 다양" if diff > 0 else "더 유사"}')

# ── 3. 의견 유사도 ────────────────────────────────────────────────────────

print('\n' + '='*60)
print('3. 에이전트 opinion 코사인 유사도')
print('='*60)

def avg_pairwise_cosine(texts):
    texts = [t for t in texts if isinstance(t, str) and t.strip()]
    if len(texts) < 2:
        return np.nan
    vec = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 3), min_df=1)
    try:
        mat = vec.fit_transform(texts)
    except ValueError:
        return np.nan
    sim = cosine_similarity(mat)
    n = len(texts)
    pairs = [(i, j) for i in range(n) for j in range(i+1, n)]
    return float(np.mean([sim[i][j] for i, j in pairs]))

sim_records = []
for (scenario, condition, ts), group in r0.groupby(['scenarioId', 'condition', 'timestamp']):
    sim = avg_pairwise_cosine(group['opinion'].tolist())
    sim_records.append({'scenarioId': scenario, 'condition': condition, 'similarity': sim})

sim_df = pd.DataFrame(sim_records)
sim_summary = sim_df.groupby('condition')['similarity'].agg(['mean', 'std', 'count']).round(4)
print(sim_summary)

asym_sim = sim_df[sim_df['condition'] == 'asymmetric']['similarity'].mean()
sym_sim  = sim_df[sim_df['condition'] == 'symmetric']['similarity'].mean()
print(f'\n비대칭 평균 유사도: {asym_sim:.4f} / 대칭: {sym_sim:.4f}')
print(f'→ 비대칭이 {"더 독립적" if asym_sim < sym_sim else "더 유사"}')

fig, ax = plt.subplots(figsize=(7, 4))
sim_plot = sim_df.pivot_table(index='scenarioId', columns='condition', values='similarity')
sim_plot.plot(kind='bar', ax=ax, color=['#4C72B0', '#DD8452'], rot=15)
ax.set_title('에이전트 opinion 유사도 -- 조건별', fontsize=12)
ax.set_ylabel('코사인 유사도')
ax.set_ylim(0, 1)
ax.legend(title='조건')
ax.grid(axis='y', alpha=0.3)
plt.tight_layout()
plt.savefig(DATA_PATH.parent / 'plot_3_similarity.png', dpi=150)
print('→ plot_3_similarity.png 저장')

# ── 4. Stance 분포 ────────────────────────────────────────────────────────

print('\n' + '='*60)
print('4. Round 1 Stance 분포')
print('='*60)

stance_counts = r1.groupby(['condition', 'stance']).size().reset_index(name='count')
stance_counts['pct'] = stance_counts.groupby('condition')['count'].transform(
    lambda x: (x / x.sum() * 100).round(1)
)
print(stance_counts.pivot_table(index='stance', columns='condition', values='pct').fillna(0))

for condition in ['asymmetric', 'symmetric']:
    subset = r1[r1['condition'] == condition]
    disagree_rate = (subset['stance'] == 'disagree').mean() * 100
    print(f'{condition}: disagree {disagree_rate:.1f}%')

fig, axes = plt.subplots(1, 2, figsize=(10, 4))
stance_order = ['agree', 'partial', 'disagree']
stance_colors = ['#2ecc71', '#f39c12', '#e74c3c']
for ax, condition in zip(axes, ['asymmetric', 'symmetric']):
    subset = r1[r1['condition'] == condition]
    counts = [subset[subset['stance'] == s].shape[0] for s in stance_order]
    ax.pie(counts, labels=stance_order, colors=stance_colors, autopct='%1.1f%%', startangle=90)
    ax.set_title(condition, fontsize=12)
plt.suptitle('Round 1 Stance 분포', fontsize=13)
plt.tight_layout()
plt.savefig(DATA_PATH.parent / 'plot_4_stance.png', dpi=150)
print('→ plot_4_stance.png 저장')

# ── 5. 정보 누출 패턴 ─────────────────────────────────────────────────────

print('\n' + '='*60)
print('5. 정보 누출 -- logic·technical의 회사 정보 키워드 언급')
print('='*60)

ORG_KEYWORDS = ['재무', '영업이익', '매출', '흑자', '적자', '성장', '공시',
                '설립', '상장', '조직 문화', '문화', '직원', '인력']

def count_keywords(text):
    if not isinstance(text, str):
        return 0
    return sum(kw in text for kw in ORG_KEYWORDS)

non_org = r0[r0['agentId'] != 'organization'].copy()
non_org['kw_count'] = non_org['opinion'].apply(count_keywords)

leak_summary = (
    non_org.groupby(['condition', 'agentId'])['kw_count']
    .agg(['mean', 'sum'])
    .round(2)
)
print(leak_summary)

asym_leak = non_org[non_org['condition'] == 'asymmetric']['kw_count'].mean()
sym_leak  = non_org[non_org['condition'] == 'symmetric']['kw_count'].mean()
print(f'\n비대칭 평균 키워드: {asym_leak:.2f} / 대칭: {sym_leak:.2f}')
if sym_leak > asym_leak:
    print('→ 대칭 조건에서 회사 정보 언급 더 많음 (정보 누출 확인)')
else:
    print('→ 조건 간 차이 없음')

# ── 요약 ──────────────────────────────────────────────────────────────────

print('\n' + '='*60)
print('탐색적 분석 요약')
print('='*60)
print(f'[점수 분산]    비대칭 {asym_std:.2f} / 대칭 {sym_std:.2f}  → {"비대칭이 더 다양" if asym_std > sym_std else "대칭이 더 다양"}')
print(f'[opinion 유사도] 비대칭 {asym_sim:.4f} / 대칭 {sym_sim:.4f}  → {"비대칭이 더 독립적" if asym_sim < sym_sim else "대칭이 더 독립적"}')
print(f'[정보 누출]    비대칭 {asym_leak:.2f}회 / 대칭 {sym_leak:.2f}회')
print()
print('※ N이 작아 통계 유의성 판단 불가. 패턴 방향만 참고.')
print('그래프: data/plot_*.png')
