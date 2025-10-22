import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Espera un pages.csv con columnas: url,title,h1,content,clicks,impressions
DF = pd.read_csv('pages.csv')
DF['text'] = (DF['title'].fillna('') + ' ' + DF['h1'].fillna('') + ' ' + DF['content'].fillna(''))
vec = TfidfVectorizer(min_df=2, ngram_range=(1,2))
X = vec.fit_transform(DF['text'])
S = cosine_similarity(X)

out = []
for i, row in DF.iterrows():
  sims = list(enumerate(S[i]))
  sims = sorted(sims, key=lambda x: x[1], reverse=True)[:20]
  for j, score in sims:
    if j == i: 
      continue
    if DF.loc[j, 'impressions'] <= DF.loc[i, 'impressions']: 
      continue
    if score < 0.15: 
      continue
    out.append({
      'from_url': row['url'],
      'to_url': DF.loc[j,'url'],
      'suggested_anchor': DF.loc[j,'title'][:60],
      'similarity': round(float(score),3)
    })

pd.DataFrame(out).to_csv('suggested_links.csv', index=False)
print('Sugerencias guardadas en suggested_links.csv')