(define-trait nft-trait
  (
    (get-last-token-id () (response uint uint))
    (get-token-uri (uint) (response (optional (string-ascii 256)) uint))
    (get-owner (uint) (response (optional principal) uint))
    (transfer (uint principal principal) (response bool uint))
  )
)

(define-non-fungible-token pill-nft uint)

(define-map token-metadata uint
  {
    batch-id: uint,
    mfg-date: uint,
    exp-date: uint,
    serial: (string-ascii 32),
    composition: (string-utf8 256),
    dosage: (string-ascii 50),
    manufacturer: principal
  }
)

(define-map owners uint principal)

(define-data-var last-token-id uint u0)

(define-data-var contract-owner principal tx-sender)

(define-data-var mint-paused bool false)

(define-data-var base-uri (string-ascii 256) "https://pharmachain.api/token/")

(define-map minters principal bool)

(define-constant ERR-UNAUTHORIZED u100)

(define-constant ERR-NOT-FOUND u101)

(define-constant ERR-ALREADY-EXISTS u102)

(define-constant ERR-PAUSED u103)

(define-constant ERR-INVALID-BATCH-ID u104)

(define-constant ERR-INVALID-DATE u105)

(define-constant ERR-INVALID-SERIAL u106)

(define-constant ERR-INVALID-COMPOSITION u107)

(define-constant ERR-INVALID-DOSAGE u108)

(define-constant ERR-INVALID-MANUFACTURER u109)

(define-constant ERR-INVALID-TOKEN-ID u110)

(define-constant ERR-TRANSFER-NOT-ALLOWED u111)

(define-constant ERR-BURN-NOT-ALLOWED u112)

(define-constant ERR-METADATA-UPDATE-NOT-ALLOWED u113)

(define-constant ERR-INVALID-URI u114)

(define-constant ERR-MAX-TOKENS-EXCEEDED u115)

(define-data-var max-tokens uint u1000000)

(define-private (validate-batch-id (id uint))
  (if (> id u0)
    (ok true)
    (err ERR-INVALID-BATCH-ID)
  )
)

(define-private (validate-date (date uint))
  (if (> date u0)
    (ok true)
    (err ERR-INVALID-DATE)
  )
)

(define-private (validate-serial (serial (string-ascii 32)))
  (if (and (> (len serial) u0) (<= (len serial) u32))
    (ok true)
    (err ERR-INVALID-SERIAL)
  )
)

(define-private (validate-composition (comp (string-utf8 256)))
  (if (<= (len comp) u256)
    (ok true)
    (err ERR-INVALID-COMPOSITION)
  )
)

(define-private (validate-dosage (dos (string-ascii 50)))
  (if (<= (len dos) u50)
    (ok true)
    (err ERR-INVALID-DOSAGE)
  )
)

(define-private (validate-manufacturer (man principal))
  (if (is-eq man tx-sender)
    (ok true)
    (err ERR-INVALID-MANUFACTURER)
  )
)

(define-private (is-minter (caller principal))
  (default-to false (map-get? minters caller))
)

(define-private (is-owner (token-id uint) (caller principal))
  (is-eq caller (default-to 'SP000000000000000000002Q6VF78 (map-get? owners token-id)))
)

(define-public (set-contract-owner (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-UNAUTHORIZED))
    (var-set contract-owner new-owner)
    (ok true)
  )
)

(define-public (add-minter (new-minter principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-UNAUTHORIZED))
    (map-set minters new-minter true)
    (ok true)
  )
)

(define-public (remove-minter (minter principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-UNAUTHORIZED))
    (map-delete minters minter)
    (ok true)
  )
)

(define-public (pause-mint)
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-UNAUTHORIZED))
    (var-set mint-paused true)
    (ok true)
  )
)

(define-public (resume-mint)
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-UNAUTHORIZED))
    (var-set mint-paused false)
    (ok true)
  )
)

(define-public (set-base-uri (new-uri (string-ascii 256)))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-UNAUTHORIZED))
    (asserts! (> (len new-uri) u0) (err ERR-INVALID-URI))
    (var-set base-uri new-uri)
    (ok true)
  )
)

(define-public (set-max-tokens (new-max uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-UNAUTHORIZED))
    (asserts! (> new-max (var-get last-token-id)) (err ERR-INVALID-TOKEN-ID))
    (var-set max-tokens new-max)
    (ok true)
  )
)

(define-public (mint (recipient principal)
                     (batch-id uint)
                     (mfg-date uint)
                     (exp-date uint)
                     (serial (string-ascii 32))
                     (composition (string-utf8 256))
                     (dosage (string-ascii 50)))
  (let ((new-token-id (+ (var-get last-token-id) u1)))
    (asserts! (not (var-get mint-paused)) (err ERR-PAUSED))
    (asserts! (is-minter tx-sender) (err ERR-UNAUTHORIZED))
    (asserts! (< (var-get last-token-id) (var-get max-tokens)) (err ERR-MAX-TOKENS-EXCEEDED))
    (try! (validate-batch-id batch-id))
    (try! (validate-date mfg-date))
    (try! (validate-date exp-date))
    (try! (validate-serial serial))
    (try! (validate-composition composition))
    (try! (validate-dosage dosage))
    (try! (nft-mint? pill-nft new-token-id recipient))
    (map-set token-metadata new-token-id
      {
        batch-id: batch-id,
        mfg-date: mfg-date,
        exp-date: exp-date,
        serial: serial,
        composition: composition,
        dosage: dosage,
        manufacturer: tx-sender
      }
    )
    (map-set owners new-token-id recipient)
    (var-set last-token-id new-token-id)
    (print { event: "mint", token-id: new-token-id, recipient: recipient })
    (ok new-token-id)
  )
)

(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender sender) (err ERR-UNAUTHORIZED))
    (asserts! (is-owner token-id sender) (err ERR-UNAUTHORIZED))
    (try! (nft-transfer? pill-nft token-id sender recipient))
    (map-set owners token-id recipient)
    (print { event: "transfer", token-id: token-id, from: sender, to: recipient })
    (ok true)
  )
)

(define-public (burn (token-id uint))
  (let ((owner (unwrap! (map-get? owners token-id) (err ERR-NOT-FOUND))))
    (asserts! (is-eq tx-sender owner) (err ERR-UNAUTHORIZED))
    (try! (nft-burn? pill-nft token-id owner))
    (map-delete token-metadata token-id)
    (map-delete owners token-id)
    (print { event: "burn", token-id: token-id, owner: owner })
    (ok true)
  )
)

(define-public (update-metadata (token-id uint)
                                (new-exp-date uint)
                                (new-composition (string-utf8 256))
                                (new-dosage (string-ascii 50)))
  (let ((metadata (unwrap! (map-get? token-metadata token-id) (err ERR-NOT-FOUND)))
        (owner (unwrap! (map-get? owners token-id) (err ERR-NOT-FOUND))))
    (asserts! (is-eq tx-sender (get manufacturer metadata)) (err ERR-UNAUTHORIZED))
    (try! (validate-date new-exp-date))
    (try! (validate-composition new-composition))
    (try! (validate-dosage new-dosage))
    (map-set token-metadata token-id
      (merge metadata
        {
          exp-date: new-exp-date,
          composition: new-composition,
          dosage: new-dosage
        }
      )
    )
    (print { event: "metadata-update", token-id: token-id })
    (ok true)
  )
)

(define-read-only (get-metadata (token-id uint))
  (map-get? token-metadata token-id)
)

(define-read-only (get-owner (token-id uint))
  (ok (map-get? owners token-id))
)

(define-read-only (get-last-token-id)
  (ok (var-get last-token-id))
)

(define-read-only (get-token-uri (token-id uint))
  (ok (some (concat (var-get base-uri) (int-to-ascii token-id))))
)

(define-read-only (is-mint-paused)
  (ok (var-get mint-paused))
)

(define-read-only (get-max-tokens)
  (ok (var-get max-tokens))
)

(define-read-only (get-base-uri)
  (ok (var-get base-uri))
)

(define-read-only (get-contract-owner)
  (ok (var-get contract-owner))
)