# J5X6: Bun compatibility evaluation plan

## 設計概要

本設計は、既存方針である **Node 24 + pnpm + Biome + `node:test` + Nix shell** を維持したまま、Bun を **別系統の go/no-go 評価ゲート**として検証するための計画を定義します。  
この task は Bun への移行計画ではなく、**「採用可否を判断するために何を確認するか」**だけを固定します。  
また、今回の判定モデルでは **lower-effort path** を優先し、**`adopt-mcp-only` は追加しません**。MCP-only adoption は意図的に current evaluation scope 外とします。

前提:

- A7K2 で固定した MCP baseline は崩さない
- Q4M8 / H1R5 / N9C3 / T6P1 で固定した境界・契約・layout・phase は reopen しない
- W2D7 / B8L4 / E3V9 / K7F0 で固定した adapter / toolchain / internal usage policy を前提にする
- Bun は structural migration に束ねず、**独立した評価タスク**として扱う
- 採用失敗は正常な結論であり、defer を許容する

---

## 評価の目的

評価対象は次の 4 点です。

1. **runtime 互換性**  
   MCP adapter と CLI adapter が Bun 上でも期待どおり動くか
2. **tooling / package manager 影響**  
   pnpm・Biome・`node:test`・Nix shell baseline と衝突しないか
3. **MCP 固有リスク**  
   stdio、MCP SDK 挙動、長時間プロセス安定性、エラー写像に問題がないか
4. **CLI 固有の機会と制約**  
   単発起動の速度面メリットがあるか、既存 CLI 契約を壊さないか

---

## この task で検証対象にするもの

### 1. 共通評価項目

- Bun で install / run を試すのではなく、**「Node baseline と同等の externally observable behavior が出るか」**を確認する
- Node baseline を正とし、差分が出た場合は Bun 側を例外扱いではなく **defer 候補**として記録する
- internal workspace 前提を崩さない
- npm publish 前提の互換性は評価対象外

共通観点:

- ESM / import 解決
- `package.json` の `exports` / `bin` / workspace 解決
- `process.env` 利用
- stdio 挙動
- exit code 挙動
- Unicode 長さ判定など JavaScript runtime 差異の有無
- 依存ライブラリが Bun runtime で動作するか
- **baseline workflow 非回帰**  
  Node 24 / pnpm / Biome / `node:test` / Nix shell の既存実行導線が、Bun 評価を追加しても**手順変更なしでそのまま通ること**

### 2. MCP 側で確認すること

#### 必須確認

- MCP サーバーが Bun 上で起動できること
- stdio transport 前提でクライアントと接続できること
- `notify_send` 相当の tool call が成功時に baseline どおり応答すること
- **長時間/runtime 安定性**として、少なくとも以下を確認すること
  - 起動後に一定時間 idle のまま待機し、その後の tool call に正常応答する
  - 複数の sequential tool call を同一プロセスで連続処理できる
  - クライアント disconnect 後に reconnect して再度利用できる
  - `SIGINT` / `SIGTERM` で graceful shutdown できる
  - 異常終了後に再起動できる
  - shutdown 後に hang や lingering process が残らない
- W2D7 の評価モデルに合わせ、少なくとも次の failure bucket を**分けて**確認すること
  - **boot-time startup failures**: 起動直後の import / config / stdio 初期化失敗
  - **request-time tool-input failures**: tool schema / validation / 入力不備による失敗
  - **request-time downstream/runtime failures**: 外部送信・依存ライブラリ・runtime 例外による失敗
- watch / dev 相当の開発導線が必要なら成立可否を確認すること

#### MCP 固有リスク

- Bun の stdio 実装差分で MCP framing や flush が不安定にならないか
- 利用予定 MCP SDK / HTTP 周辺依存が Bun runtime で unsupported API を要求しないか
- signal / shutdown 時の close 挙動が Node baseline と大きくズレないか
- stack trace や error object shape の差分で adapter の error mapping が壊れないか

### 3. CLI 側で確認すること

#### 必須確認

- `notifier --message ... [--title ...]` が Bun 上でも H1R5 の固定契約どおり動くこと
- `--help` の stdout / exit code `0` が保たれること
- usage error / validation error / config error / send error / unexpected error の stderr / exit code が保たれること
- env-only 設定解決方針が変わらないこと
- 成功時無出力が保たれること

#### CLI 側の機会確認

- 単発起動の cold start が Node baseline より有意に改善するか
- ローカル実行導線が Bun 導入で簡単になるか、それとも複雑化するか
- CLI 単体では有利でも、workspace 全体運用を悪化させないか

---

## 評価方法

### Phase A: desk-check

実装前提を変えず、まず以下を棚卸しする。

- 依存ライブラリの Bun 対応状況
- MCP SDK の Bun 実績または既知 issue
- pnpm workspace との併用可否
- Nix shell で Bun を追加しても baseline を壊さないか
- Node 24 / pnpm / Biome / `node:test` / Nix shell の既存 workflow を変更せず維持できるか

### Phase B: runtime smoke evaluation

最小限の実行確認を行う。

- MCP: 起動、接続、単一 tool call、各 failure bucket 1 件以上
- CLI: `--help`、成功系、usage error、config error、send error
- baseline workflow: Node 実行、pnpm script、Biome、`node:test`、Nix shell 内実行が**従来どおり**通ること

### Phase C: behavior parity evaluation

Node baseline と Bun で差分比較する。

- stdout / stderr
- exit code
- error category
- env 解決
- 入力長さ・blank 判定
- プロセス終了性
- MCP の idle→再応答、sequential tool call、disconnect/reconnect、signal shutdown、abnormal restart
- W2D7 failure bucket ごとの error mapping 一致

### Phase D: operational fit evaluation

導入した場合の運用負荷を確認する。

- pnpm を維持したまま Bun runtime だけ追加できるか
- Biome / `node:test` / Nix shell と二重管理にならないか
- CI / local dev / docs に増える複雑性が許容範囲か
- Bun 評価の追加後も、既存の Node/pnpm/Biome/`node:test`/Nix shell workflow が**変更不要**のまま維持されるか

---

## 採用判定基準

### 最低限そろえる証跡

採否判断は印象論ではなく、少なくとも以下の証跡がそろってから行います。

- **MCP 証跡**
  - boot-time startup failures / request-time tool-input failures / request-time downstream/runtime failures を各 1 件以上確認し、Node baseline と同じ error category に写像できる
  - success path に加え、idle→再応答、sequential tool call、disconnect/reconnect、`SIGINT` / `SIGTERM`、abnormal restart、shutdown 後の lingering process 不在を確認する
- **CLI 証跡**
  - `--help`、成功系、usage error、validation/config error、send error、unexpected error で stdout / stderr / exit code を比較する
- **baseline 非回帰証跡**
  - Node 24 実行、pnpm workflow、Biome、`node:test`、Nix shell workflow が、Bun 評価追加後も**既存手順のまま**通ることを確認する
- **運用証跡**
  - pnpm authority を維持できること
  - Bun を runtime only として追加しても docs / CI / local dev の複雑性が限定的であること

### threshold-style rule

以下を満たさない限り adopt 判定は行いません。

- 必須チェック項目の **未確認が 0 件**
- 必須チェック項目の **blocker / high-severity failure が 0 件**
- baseline workflow 非回帰チェックの **失敗が 0 件**
- 採用対象（CLI または MCP）ごとに、Node baseline との差分がある場合は **説明可能で許容判断済みの差分のみ**
- CLI 採用を進める場合は、少なくとも **再現可能な利点が 1 つ**あること  
  （例: 単発起動の改善を複数回観測、または導線簡素化を手順差分で説明可能）

### 決定アウトカム

- **adopt-none**
  - MCP/CLI のいずれも採用条件を満たさない
- **adopt-cli-only**
  - CLI は採用条件を満たすが、MCP は満たさない
- **adopt-cli-and-mcp**
  - CLI と MCP の両方が採用条件を満たす

補足:

- **`adopt-mcp-only` は設けない**
- MCP が採用条件を満たしても CLI が満たさない場合、**MCP-only adoption はこの評価では扱わず**、結果は **defer / adopt-none 扱い**とする
- これは MCP-only を否定するためではなく、今回の意思決定モデルを最小限に保ち、後続判断の分岐を増やさないためである

### defer とする条件

以下のいずれかがあれば、対象範囲を **defer** とする。

- MCP 側で boot-time startup failure、stdio/MCP 通信不安定、long-running 安定性問題が残る
- MCP SDK や主要依存に Bun 非互換・未検証リスクが残る
- CLI 契約の stdout / stderr / exit code / validation semantics がズレる
- Node 24 / pnpm / Biome / `node:test` / Nix shell の baseline workflow を**変更なしで維持できない**
- pnpm baseline を実質的に崩す必要がある
- `node:test` や Nix shell baseline と衝突し、toolchain authority が曖昧になる
- 採用メリットを再現可能な証跡で示せない
- CI / local dev / docs / support 負荷が増えるわりに利益が限定的

なお defer は **Bun 全面否定**を意味しない。  
特に runtime-only 採用を defer した場合でも、将来の **CLI 限定の Bun 利点**（例: 単発起動面の改善）を、今回の評価範囲とは切り分けて再評価する余地は残す。

---

## MCP 側と CLI 側の判定優先度

### MCP 側

MCP は baseline 維持の重要度が高いため、**保守的に判定**する。

- 軽微な性能差よりも **通信安定性と互換性**を優先
- 不確実な挙動が 1 つでも残る場合は adopt ではなく defer を優先
- 特に boot-time startup failures / request-time tool-input failures / request-time downstream/runtime failures は個別に評価し、まとめて「異常系」で済ませない

### CLI 側

CLI は Bun の利点が出やすい候補だが、単独最適では決めない。

- 起動速度改善は加点要素
- ただし CLI だけ良くても、workspace/toolchain 全体を複雑化するなら defer 候補

---

## package manager / toolchain 観点の確認項目

- pnpm は継続前提であり、Bun package manager への切替可否は本 task の採用条件にしない
- Bun 採用案が **runtime only** で成立するかを優先確認する
- `bun install` / Bun lockfile / Bun workspace へ寄せる必要が出るなら、原則 defer 寄りに扱う
- Biome 実行系を Bun ベースへ移す前提は置かない
- test runner を Bun test に置き換える前提は置かない
- Nix shell に Bun を追加する場合も、Node 24 + pnpm authority を置き換えない
- Node 実行、pnpm install / script、Biome、`node:test`、Nix shell 既存手順を変更させない

---

## この task が意図的に決めないこと

本 task は次を決めません。

- Bun へ即時移行すること
- Node 24 baseline を廃止すること
- pnpm を Bun package manager に置き換えること
- `node:test` を Bun test に置き換えること
- Nix shell baseline を再設計すること
- phased migration sequence へ Bun 導入を束ねること
- MCP / CLI / core の責務境界を変更すること
- npm publish を前提にした配布戦略

---

## トレードオフと設計判断

### 判断 1: Bun は独立ゲートとして扱う

- 採用理由
  - 構造移行と runtime 評価を分離できる
  - Bun 不採用でも既存計画を止めない
- 代替案
  - workspace/CLI 追加と同時に Bun へ寄せる
- 採らない理由
  - 失敗時に原因分離が難しくなる

### 判断 2: MCP と CLI を分けて評価する

- 採用理由
  - MCP は安定性重視、CLI は起動速度メリット重視で判断軸が違う
  - CLI での利点が MCP 側リスクを打ち消さないことを明確にできる
  - adopt-none / adopt-cli-only / adopt-cli-and-mcp を分けて決められる
  - lower-effort path として、意思決定アウトカムを増やしすぎずに済む
- 代替案
  - repository 全体で一括採否にする
  - `adopt-mcp-only` を追加する
- 採らない理由
  - リスクと利益の所在がぼやける
  - MCP-only 採用判断まで含めると、今回の strict scope を超えて判定分岐と後続運用が増える

### 判断 3: 採用条件に toolchain fit を含める

- 採用理由
  - この repo の baseline は Node 24 + pnpm + Biome + `node:test` + Nix shell で固定済み
  - runtime だけ動いても運用が壊れるなら採用価値が低い
- 代替案
  - runtime 動作だけ見て採用可とする
- 採らない理由
  - 後続で運用コストが顕在化しやすい

### 判断 4: defer を正常な結論として明記する

- 採用理由
  - Bun 採用を既定路線にしない
  - 評価を実務的に進めやすい
- 代替案
  - Bun 採用前提で不足点だけ潰す
- 採らない理由
  - task の strict scope に反する

---

## 実装への影響

- この task 時点では **実装変更なし**
- 後続 task が必要なら、評価結果に基づいて別途起票する
- defer の場合でも、既存 Node baseline と phased migration はそのまま進められる

---

## 結論

J5X6 の結論は、Bun を **MCP と CLI に分けて、runtime 互換性・MCP 固有リスク・CLI の実利・pnpm/toolchain との整合性**で評価することです。  
判定結果は **adopt-none / adopt-cli-only / adopt-cli-and-mcp** を取り得ます。  
**`adopt-mcp-only` は今回の評価モデルに含めません。** MCP が通って CLI が通らない場合も、current evaluation では **defer / adopt-none 扱い**とし、Node 24 + pnpm + Biome + `node:test` + Nix shell の baseline を維持します。  
採用条件を満たさなければ該当範囲を **defer** とし、将来の **CLI 限定の Bun 利点**は今回の範囲外として別途再評価余地を残します。
