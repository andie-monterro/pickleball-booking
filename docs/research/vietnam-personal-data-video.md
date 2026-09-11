# Vietnam personal data law and court-side video recording

## Scope and scenario

A venue installs a camera covering a pickleball court. The camera films everyone who plays during a session: the person who booked the court ("the Booker") and any other players who never signed up for anything in the booking app. After the session, the venue gives the recording to the Booker only. The booking app itself stores only the Booker's display name and a verified phone number (per an existing ADR); it holds nothing about the other players, so there is no in-app record to attach anyone else's consent to.

This document reports what Vietnamese primary legal sources say about that scenario, organized around eight specific questions. It does not give legal advice, a recommendation, or a verdict. Where a source is silent or ambiguous, that is stated explicitly rather than filled in with inference or with reasoning imported from other jurisdictions (e.g., GDPR). Any GDPR comparison appearing below is explicitly labeled as such and is not a statement of Vietnamese law.

All citations are to the primary legal texts as retrieved from the Government Gazette (Công báo) and the Government's own legal document portal. Full source details are in the closing section.

---

## 1. Current legal status of Decree 13/2023/ND-CP and the Personal Data Protection Law

**As of September 2026, Decree 13/2023/NĐ-CP is no longer in force.** It has been replaced by two instruments that took effect together on 1 January 2026:

1. **Law on Personal Data Protection No. 91/2025/QH15** ("the PDPL" / "Luật Bảo vệ dữ liệu cá nhân"), passed by the National Assembly (15th Legislature, Quốc hội khóa XV, 9th session) on 26 June 2025. Article 38.1 of the Law states it "has effect from 1 January 2026" ("Luật này có hiệu lực thi hành từ ngày 01 tháng 01 năm 2026"). Published in Công báo (Official Gazette) Nos. 971+972, dated 24 July 2025.

2. **Decree No. 356/2025/NĐ-CP**, dated 31 December 2025, "detailing a number of articles and implementation measures of the Law on Personal Data Protection" ("Quy định chi tiết một số điều và biện pháp thi hành Luật Bảo vệ dữ liệu cá nhân"). Its Article 42.1 sets its own effective date as 1 January 2026, and Article 42.2 states explicitly: *"Nghị định số 13/2023/NĐ-CP ngày 17 tháng 4 năm 2023 của Chính phủ về bảo vệ dữ liệu cá nhân hết hiệu lực kể từ ngày Nghị định này có hiệu lực thi hành"* ("Decree No. 13/2023/NĐ-CP dated 17 April 2023 ... ceases to be effective from the date this Decree takes effect"). Published in Công báo No. 18, dated 18 January 2026.

So the relationship is: **the Law is the new primary statute in this field, and Decree 356 is the new implementing decree that replaces Decree 13 in that role.** It is Decree 356 (Article 42.2, quoted above), not the Law itself, that repeals Decree 13 — the Law does not contain a repeal clause naming Decree 13. It is not that Decree 13's provisions were folded into the Law verbatim; the Law and Decree 356 are both new texts, and Decree 13 is dead law as of 1 January 2026.

Two transitional points from the Law itself matter for any venue that was already operating under Decree 13 (Article 39, "Quy định chuyển tiếp"):
- Processing already consented to or agreed under Decree 13 before the Law took effect continues without needing to re-obtain consent (Article 39.1).
- Impact-assessment dossiers already filed with and accepted by the specialist data-protection authority under Decree 13 remain usable and do not need to be re-filed under the new Law, though updates to them after the Law's effective date follow the new Law (Article 39.2).

All article numbers cited in the rest of this document refer to the **Law (91/2025/QH15)** unless a citation explicitly says "Decree 356/2025/NĐ-CP."

---

## 2. Is a person's image on video "personal data"? Is it "sensitive personal data"?

**Short answer:** Yes, a person's image is personal data. It is explicitly classified as *basic* personal data (not automatically sensitive) by the Government's own list; it would only become sensitive personal data if its content falls into one of the separately listed sensitive categories (e.g., it reveals health status, sexual orientation, etc.).

**Citations and text:**

- Law, Article 2.1: *"Dữ liệu cá nhân là dữ liệu số hoặc thông tin dưới dạng khác xác định hoặc giúp xác định một con người cụ thể, bao gồm: dữ liệu cá nhân cơ bản và dữ liệu cá nhân nhạy cảm."* ("Personal data is digital data or information in another form that identifies or helps identify a specific person, comprising basic personal data and sensitive personal data.") It also states de-identified data is no longer personal data.
- Law, Article 2.2–2.3 define "basic personal data" and "sensitive personal data" only in general terms, each closing with *"thuộc danh mục do Chính phủ ban hành"* ("belonging to a list issued by the Government") — i.e., the Law delegates the actual itemized lists to a decree.
- **Decree 356/2025/NĐ-CP, Article 3** ("Danh mục dữ liệu cá nhân cơ bản" — List of basic personal data) item 6 explicitly lists: *"Hình ảnh của cá nhân"* ("An individual's image/photograph"). This places a person's image, as such, in the *basic* personal data category.
- **Decree 356/2025/NĐ-CP, Article 4** ("Danh mục dữ liệu cá nhân nhạy cảm" — List of sensitive personal data) lists: race/ethnic origin data; political/religious/belief views; private-life and family-secret information; health status; biometric and genetic data; data revealing sexual life or orientation; crime/violation data held by law enforcement; location data from positioning services; e-ID login credentials and images of ID cards; banking/financial credentials and transaction history; telecom/social-media/online-service behavior-tracking data; and a residual catch-all for "other personal data that the law requires be kept confidential or requires strict security measures." **A person's image as a general category is not on this sensitive-data list.**

One further distinction the texts do draw: **Law, Article 31.2** defines biometric data ("Dữ liệu sinh trắc học") as *"dữ liệu về thuộc tính vật lý, đặc điểm sinh học riêng biệt và ổn định của một người để xác định người đó"* (data on the physical attributes and distinct, stable biological characteristics of a person, used to identify that person), and **Decree 356/2025/NĐ-CP, Article 4.1(đ)** places "dữ liệu sinh trắc học, đặc điểm di truyền" (biometric and genetic data) on the sensitive-data list. So raw video of a person is basic personal data (Decree 356 Art. 3.6), but a derivative extracted from it for identification purposes — e.g., a face-recognition template — would be biometric data and therefore sensitive.

**Silence/ambiguity:** The sensitive-data list is otherwise content-based, not medium-based — it does not address whether ordinary video of someone (e.g., playing pickleball) could become sensitive because it incidentally shows something like a health condition or another item on the sensitive list. Neither the Law nor Decree 356 explicitly discusses camera footage of a sports court as a category, so whether *this* footage is "basic" or partly "sensitive" is not separately answered by the text and would depend on what the footage actually shows.

---

## 3. Does a notice at the entrance justify recording people who never sign up for anything?

**Short answer:** The Law has a dedicated article for exactly this situation — recording at public places / public activities without the consent of those recorded — and it does treat a notice (not necessarily an entrance sign specifically) as satisfying the notice condition. But several conditions and one real ambiguity attach.

**Citation and text — Law, Article 32** ("Bảo vệ dữ liệu cá nhân thu được từ hoạt động ghi âm, ghi hình tại nơi công cộng, hoạt động công cộng" — Protection of personal data obtained from audio/video recording at public places or public activities):

- Article 32.1: organizations/individuals may record and process personal data obtained from recording **at public places or public activities without the data subject's consent** in these cases:
  - (a) *"Để thực hiện nhiệm vụ quốc phòng, bảo vệ an ninh quốc gia, bảo đảm trật tự, an toàn xã hội, bảo vệ quyền, lợi ích hợp pháp của cơ quan, tổ chức, cá nhân"* (national defense, national security, public order and safety, or protecting the lawful rights/interests of organizations/individuals);
  - (b) *"Âm thanh, hình ảnh, các thông tin nhận dạng khác thu được từ các hoạt động công cộng bao gồm hội nghị, hội thảo, hoạt động thi đấu thể thao, biểu diễn nghệ thuật và hoạt động công cộng khác mà không làm tổn hại đến danh dự, nhân phẩm, uy tín của chủ thể dữ liệu cá nhân"* (sound, images, other identifying information from public activities including conferences, seminars, **sports competitions**, performances, and other public activities, provided this does not harm the data subject's dignity, honor, or reputation);
  - (c) other cases as provided by law.
- Article 32.2: *"Trường hợp ghi âm, ghi hình theo quy định tại khoản 1 Điều này, cơ quan, tổ chức, cá nhân có trách nhiệm thông báo hoặc bằng hình thức thông tin khác để chủ thể dữ liệu cá nhân biết được mình đang bị ghi âm, ghi hình, trừ trường hợp pháp luật có quy định khác."* (Where recording occurs under clause 1, the organization/individual must notify — or inform by another means — so the data subject knows they are being recorded, unless the law provides otherwise.)
- Article 32.3: data obtained this way may only be processed/used consistent with the recording's purpose, and not for unlawful purposes or purposes that infringe the data subject's lawful rights/interests.

**How this maps to a notice sign:** Article 32.2's notice obligation is satisfied by "thông báo hoặc bằng hình thức thông tin khác" (notification or another form of information) — a visible sign at the entrance is a plausible way to meet this, since the article does not prescribe a specific wording or medium.

**Silence/ambiguity:**
- The Law does not define "nơi công cộng" (public place) or state whether a paid, access-controlled private sports venue counts as one. Ground (b) names "hoạt động thi đấu thể thao" (sports competition activities), which is close to but not identical to ordinary recreational court play — whether a routine booked pickleball session is a "hoạt động công cộng" in the sense intended by Article 32 is not addressed.
- Separately, under Article 9.4(d) of the Law, *"sự im lặng hoặc không phản hồi không được coi là sự đồng ý"* (silence or non-response is not to be treated as consent). This confirms that a notice sign, by itself, does not create valid *consent* — Article 32 instead works as a distinct no-consent-needed basis with its own notice condition, not as a backdoor route to "implied consent."
- The Law does not specify required wording, size, or placement for the Article 32.2 notice (e.g., no requirement that it be "at the entrance" specifically, or in any particular language).

**The general no-consent basis, for comparison — Law, Article 19** ("Xử lý dữ liệu cá nhân trong trường hợp không cần sự đồng ý của chủ thể dữ liệu cá nhân"): Article 32 is a specific rule for recording; Article 19 is the Law's general list of situations where processing needs no consent at all, and it is worth citing because the brief asks which article permits no-consent processing generically (e.g. on a "legitimate interest" or "security" theory):
- 19.1(a): to protect the life, health, dignity, or lawful rights/interests of the data subject or another person, or of the State, "một cách cần thiết trước hành vi xâm phạm lợi ích nói trên" (as necessary against an act infringing those interests) in urgent circumstances — with the controller/processor bearing the burden of proving this case applies;
- 19.1(b): to handle an emergency; a national-security threat not yet at the level of a declared state of emergency; or crime/riot/terrorism prevention and law-enforcement ("phòng, chống tội phạm và vi phạm pháp luật");
- 19.1(c)–(đ): to serve a state agency's statutory duties; to perform an agreement the data subject has with a related party as provided by law; or other cases provided by law.
- Article 19.2 attaches conditions to *any* no-consent processing: the organization must set up a monitoring mechanism, comprising (a) documented procedures and defined responsibilities, (b) appropriate protective measures with regular risk assessment, (c) periodic compliance checks, and (d) a channel to receive and handle complaints/feedback from affected parties.

**Silence/ambiguity:** The Law has no generic, free-standing "legitimate interest" basis in the way some other jurisdictions' frameworks do — Article 19.1(a) is explicitly conditioned on there being an infringing act to protect against, and 19.1(b) is conditioned on emergency/security/crime-prevention framing; routine commercial CCTV for a sports venue is not obviously either of those, which is why Article 32 (a purpose-built recording rule, not phrased as a "legitimate interest" test) is the more directly applicable provision here. It is not addressed in the text whether Article 19.2's monitoring-mechanism conditions are meant to attach to recording done under Article 32, since Article 32 does not cross-reference Article 19.2 and sits in a different part of the Law.

---

## 4. Does handing the recording to the Booker need a separate legal basis?

**Short answer:** The Law's purpose-limitation principle and its specific rules on disclosure/transfer both point toward "yes, in principle" — use of recorded data is capped by the purpose that justified the recording, and transferring personal data to a third party is treated as its own regulated act with its own required grounds — but the Law does not address this exact fact pattern (giving CCTV footage of other players to a paying customer), so this is flagged as an open question rather than answered directly by the text.

**Citations and text:**

- **Provision of data to the data subject vs. to someone else — Law, Article 15** ("Cung cấp dữ liệu cá nhân") is the most directly on-point provision for "handing a copy to a person," and it splits the scenario in two:
  - Article 15.2(a): the controller provides data *to the data subject themself*, at the data subject's request, consistent with law and any agreement with them — this covers giving the Booker their own image/data.
  - Article 15.2(b): the controller provides data *to another organization/individual* only "khi được chủ thể dữ liệu cá nhân đồng ý, trừ trường hợp pháp luật có quy định khác" (when the data subject consents, unless the law provides otherwise) — this is the provision that covers giving footage of the *other* players to the Booker, who is "another" person relative to them.
  - **Decree 356/2025/NĐ-CP, Article 7.6** clarifies that provision under Article 15.2 made "dựa trên từng yêu cầu cụ thể của chủ thể dữ liệu" (based on the data subject's own specific request) is *not* classified as "chuyển giao" (transfer) and so does not need the Article 7 transfer agreement described below — but this carve-out is about the data subject's *own* data, not about a third party's data being handed over on someone else's request.
  - For completeness: Article 16 ("Công khai dữ liệu cá nhân") governs *publication* of personal data (e.g., posting it publicly), which is a different act from a one-to-one handover of a recording to a specific customer; it is not the operative provision for this scenario.
- **Purpose limitation, general principle — Article 3.2:** *"Chỉ được thu thập, xử lý dữ liệu cá nhân đúng phạm vi, mục đích cụ thể, rõ ràng, bảo đảm tuân thủ quy định của pháp luật."* (Personal data may only be collected/processed within the specific, clear scope and purpose stated, in compliance with law.)
- **Purpose limitation specific to recordings — Article 32.3:** *"Dữ liệu cá nhân thu được chỉ được xử lý, sử dụng phù hợp với mục đích xử lý, không được sử dụng vào các mục đích trái pháp luật hoặc xâm phạm đến quyền, lợi ích hợp pháp của chủ thể dữ liệu cá nhân."* (Data obtained may only be processed/used consistent with the processing purpose; it may not be used for unlawful purposes or purposes infringing the data subject's lawful rights/interests.) If the stated purpose for the camera was, e.g., security/safety (Article 32.1(a)), routinely handing footage to a customer as a service/courtesy is a different purpose from the one the notice announced — the Law's text does not say whether that crosses the Article 32.3 line.
- **Disclosure/transfer as a distinct regulated act — Article 17 ("Chuyển giao dữ liệu cá nhân")** lists the only cases in which transfer ("chuyển giao") of personal data may occur: (a) with the data subject's consent; (b) sharing between departments of the same organization for the purpose already established; (c) transfer for organizational restructuring purposes; (d) transfer to a processor or third party under an agreement; (đ) transfer at a competent state authority's request; (e) transfer under the no-consent cases of Article 19.1. Article 17.2 clarifies that a transfer under these cases — fee-charging or not — is not to be classified as "buying/selling" of data.
- **Decree 356/2025/NĐ-CP, Article 7.1** requires that any transfer under Article 17.1(a), (c) or (d) of the Law be documented in a written agreement with the data recipient specifying: the transfer's purpose; the data subjects/data types covered, matched to that purpose; the processing/retention period and deletion requirements afterward; the legal basis for the transfer; data-protection responsibilities during transfer; responsibility for the data subject's rights; and cooperation/compliance duties if a violation is found.
- **Decree 356/2025/NĐ-CP, Article 7.3** additionally regulates the case where transfer under Article 17.1(a) or (d) is *for a fee, to provide a service to the data subject or serve the data subject's own lawful interest* — it requires a transparent technical mechanism for the data subject to give clear, accurate, per-transfer consent, knowing the exact purpose and recipient, and it caps use of the transferred data strictly to that consented purpose.

**Silence/ambiguity:** None of Articles 15, 17, 19, or 32 lists "handing recorded footage of a shared facility to the customer who used it" as one of the enumerated no-consent bases for the *other players'* data. Article 15.2(b) is the closest fit and, read literally, requires *their* consent before their data is given to "another" person (the Booker) absent some other legal provision — but the Law does not discuss this fact pattern (footage of Person A handed to Person B, a different data subject present in the same recording, as a matter of routine service) so it is not clear whether some other basis (e.g., Article 19 or Article 32 read together with the venue's stated purpose) would apply instead. This is a genuine gap in the text: the Law neither clearly permits nor clearly forbids this specific disclosure; it only supplies the general purpose-limitation, provision, and transfer-basis framework above, which the venue's practice would have to be tested against.

---

## 5. What rights do filmed people have, and is there a response deadline?

**Short answer:** Yes. The Law lists the rights in Article 4.1, and Decree 356/2025/NĐ-CP, Article 5 sets out concrete response and completion deadlines for each type of request.

**Citations and text:**

- **Law, Article 4.1** ("Quyền của chủ thể dữ liệu cá nhân" — Rights of the data subject) lists:
  - (a) to be informed about the processing of their personal data;
  - (b) to consent or not consent, and to request withdrawal of consent to processing;
  - (c) to view, correct, or request correction of their personal data;
  - (d) to request the provision, deletion, or restriction of processing of their personal data; to send an objection to processing;
  - (đ) to complain, denounce, sue, or claim damages according to law;
  - (e) to request the competent authority or relevant organization/individual to apply measures/solutions to protect their personal data.
- **Law, Article 4.5**: when a request under clause 1 is received, the controller (or joint controller-processor) *"phải kịp thời thực hiện trong thời hạn theo quy định của pháp luật"* (must promptly comply within a time limit prescribed by law), and delegates the details to the Government.
- **Decree 356/2025/NĐ-CP, Article 5** sets the concrete deadlines (all counted from receipt of a properly submitted request):
  - Requests to withdraw consent, restrict processing, or object to processing (Article 5.2): acknowledge within **2 working days**, then complete within **15 days** (extendable once, by up to 15 more days, with the controller responsible for justifying the extension); if a processor or third party must also be made to stop processing, that extends to **20 days**.
  - Requests to view, correct, or provide a copy of data (Article 5.3): acknowledge within **2 working days**, then complete within **10 days** (extendable once by up to 10 more days); if a processor or third party must correct data, **15 days**.
  - Requests to delete data (Article 5.4): acknowledge within **2 working days**, then complete within **20 days** (extendable once by up to 20 more days); if a processor or third party must provide, delete, or restrict data, **30 days**.
  - Requests for protective measures (Article 5.5): acknowledge within **2 working days**, then complete within **15 days** (extendable once by up to 15 more days).
- **Grounds to refuse a deletion request — Law, Article 14.2**: a controller need not comply with a deletion request in the no-consent-needed cases of Article 19, or where deletion would itself violate Article 4.3 (the data subject's own duty to exercise rights lawfully).

**Silence/ambiguity:** None identified for this question — the deadlines are stated in specific day-counts in the Decree.

---

## 6. Does the law cap retention, or require a stated retention period?

**Short answer:** There is no fixed day/month/year cap in the text. Instead, the Law uses a purpose-tied standard: data may be kept only as long as necessary for the stated processing purpose, and recording-specific data has its own, narrower version of the same rule.

**Citations and text:**

- **General principle — Article 3.3**: *"Bảo đảm tính chính xác của dữ liệu cá nhân và được chỉnh sửa, cập nhật, bổ sung khi cần thiết; được lưu trữ trong khoảng thời gian phù hợp với mục đích xử lý dữ liệu cá nhân, trừ trường hợp pháp luật có quy định khác."* (...data is to be stored for a period appropriate to the processing purpose, unless the law provides otherwise.)
- **Recording-specific — Article 32.4**: *"Dữ liệu cá nhân thu được từ hoạt động ghi âm, ghi hình tại nơi công cộng, hoạt động công cộng chỉ được lưu trữ trong khoảng thời gian cần thiết để phục vụ mục đích thu thập, trừ trường hợp pháp luật có quy định khác. Khi hết thời hạn lưu trữ, dữ liệu cá nhân phải được xóa, hủy theo quy định của Luật này."* (Personal data obtained from recording at public places/public activities may only be stored for the time necessary to serve the collection purpose, unless the law provides otherwise. Once the storage period expires, the data must be deleted/destroyed per this Law.)
- **Deletion grounds — Article 14.1(c)**: expiry of the storage period is one of the listed lawful grounds/triggers for deletion or destruction of personal data.

**Silence/ambiguity:** Neither the Law nor Decree 356 fixes a numeric retention ceiling (e.g., "30 days," "6 months") for camera footage generally. The retention period is instead whatever the controller determines is "necessary" for its stated purpose — the text does not say who judges necessity, nor does it require the retention period to be published or disclosed to filmed persons (contrast this with the data-subject notice duty in Article 32.2, which is about the fact of recording, not about how long footage will be kept).

---

## 7. Registration / impact assessment / filing obligations — does a small venue fall within this regime?

**Short answer:** The Law creates an impact-assessment-dossier regime (and, for cross-border transfer, a separate dossier), but it also creates an explicit small-business carve-out that is highly relevant to a venue of this size: household businesses and micro-enterprises are exempt from the impact-assessment and dedicated-personnel requirements unless they are in the data-processing-services business, directly process sensitive personal data, or cross a stated data-subject volume threshold.

**Citations and text:**

- **Law, Article 21** ("Đánh giá tác động xử lý dữ liệu cá nhân"): a controller (or joint controller-processor) must prepare and keep a dossier assessing the impact of personal-data processing and send one original copy to the specialized data-protection authority **within 60 days of the first day of processing** (Article 21.1), except in the cases of Article 21.6. This assessment is done once for the life of the controller's operations and updated as required by Article 22 (Article 21.2). A processor handling data under agreement with a controller has an equivalent obligation (Article 21.3). Article 21.6: *state authorities* are not required to carry out this assessment.
- **Law, Article 20** (cross-border transfer): a similar impact-assessment dossier is required for cross-border transfers, sent to the authority **within 60 days of the first day of the cross-border transfer** (Article 20.2), with similar update rules (Article 22) and periodic/incident-triggered inspection by the authority (Article 20.4–20.5).
- **Small-business carve-out — Law, Article 38.2–38.3 / Decree 356/2025/NĐ-CP, Article 41:**
  - Law, Article 38.2: *"Doanh nghiệp nhỏ, doanh nghiệp khởi nghiệp được quyền lựa chọn thực hiện hoặc không thực hiện quy định tại Điều 21, Điều 22 và khoản 2 Điều 33 của Luật này trong thời gian 05 năm kể từ ngày Luật này có hiệu lực thi hành, trừ doanh nghiệp nhỏ, doanh nghiệp khởi nghiệp kinh doanh dịch vụ xử lý dữ liệu cá nhân, trực tiếp xử lý dữ liệu cá nhân nhạy cảm hoặc xử lý dữ liệu cá nhân của số lượng lớn chủ thể dữ liệu cá nhân"* (Small enterprises and start-ups may choose whether or not to carry out Articles 21, 22, and Article 33.2 [dedicated personnel/department] for 5 years from the Law's effective date, **except** small enterprises/start-ups that are in the personal-data-processing-services business, that directly process sensitive personal data, or that process data of a large number of data subjects.)
  - Law, Article 38.3: *"Hộ kinh doanh, doanh nghiệp siêu nhỏ không phải thực hiện quy định tại Điều 21, Điều 22 và khoản 2 Điều 33 của Luật này, trừ hộ kinh doanh, doanh nghiệp siêu nhỏ kinh doanh dịch vụ xử lý dữ liệu cá nhân, trực tiếp xử lý dữ liệu cá nhân nhạy cảm hoặc xử lý dữ liệu cá nhân của số lượng lớn chủ thể dữ liệu cá nhân"* (Household businesses and micro-enterprises are **not** required to carry out Articles 21, 22, or Article 33.2, except those that are in the personal-data-processing-services business, that directly process sensitive personal data, or that process data of a large number of data subjects.)
  - **Decree 356/2025/NĐ-CP, Article 41** quantifies "a large number of data subjects" for both of the above: the exemption is lost, and the impact-assessment/dedicated-personnel duties apply, **from the point the accumulated total of personal data subjects processed reaches 100,000 or more** ("...xử lý dữ liệu cá nhân kể từ thời điểm có quy mô đạt từ 100 nghìn chủ thể dữ liệu cá nhân trở lên dựa trên kết quả tích lũy tổng lượng dữ liệu cá nhân đã xử lý").
- **Notification obligations, generally — Law, Article 23.1**: a controller, joint controller-processor, or third party that discovers a violation of the personal-data-protection rules that could harm national defense, national security, order, social safety, or the life, health, dignity, or property of the data subject must notify the specialized data-protection authority **within 72 hours** of discovering the violation ("chậm nhất là 72 giờ kể từ khi phát hiện hành vi vi phạm"). This is a breach/incident-notification duty, distinct from the impact-assessment filing above, and it is not itself scaled by business size in the text.

**Silence/ambiguity:**
- Neither the Law nor Decree 356 itself defines "hộ kinh doanh" (household business), "doanh nghiệp siêu nhỏ" (micro-enterprise), "doanh nghiệp nhỏ" (small enterprise), or "doanh nghiệp khởi nghiệp" (start-up) — these are business-classification terms defined elsewhere in Vietnamese law (enterprise/SME-support legislation), so which category a given venue falls into is a question outside the personal-data-protection texts themselves and is not addressed here.
- The Decree does not further define what counts as "trực tiếp xử lý dữ liệu cá nhân nhạy cảm" (directly processing sensitive personal data) in a threshold or de-minimis sense — e.g., whether incidentally capturing a single frame that reveals something on the sensitive list would count.

---

## 8. Anything specific to minors?

**Short answer:** Yes — Article 24 of the Law has dedicated provisions, built around the term "trẻ em" (children), with an extra double-consent requirement for publishing/disclosing certain information about them.

**Citations and text — Law, Article 24** ("Bảo vệ dữ liệu cá nhân của trẻ em, người bị mất hoặc hạn chế năng lực hành vi dân sự, người có khó khăn trong nhận thức, làm chủ hành vi" — Protection of personal data of children, persons who have lost or have restricted civil-act capacity, and persons with cognitive/behavioral-control difficulties):

- Article 24.2: for a child, or a person who has lost/has restricted civil-act capacity, or a person with cognitive difficulty, the child's/person's *legal representative* exercises the data-subject's rights on their behalf, **except** in the no-consent cases of Article 19.1. It further states: *"Việc xử lý dữ liệu cá nhân của trẻ em nhằm công bố, tiết lộ thông tin về đời sống riêng tư, bí mật cá nhân của trẻ em từ đủ 07 tuổi trở lên thì phải có sự đồng ý của trẻ em và người đại diện theo pháp luật."* (Processing a child's personal data for the purpose of publishing or disclosing information about the private life or personal secrets of a child aged 7 or above requires the consent of **both** the child **and** the legal representative.)
- Article 24.3: processing must stop where (a) the person who gave consent under clause 2 withdraws it, or (b) a competent authority requests it upon sufficient evidence that the processing could harm the rights/lawful interests of the child or other protected person.

**Silence/ambiguity:**
- The Law does not itself define "trẻ em" (children) for its own purposes — it uses the term without a cross-reference in the text retrieved. Under separate Vietnamese law (the Law on Children, Luật Trẻ em 2016), "trẻ em" is defined as a person under 16 years of age; the PDPL text does not repeat or confirm that definition, so this document notes the term rather than asserting the exact age cut-off as settled by the PDPL itself.
- Article 24 does not separately address the intermediate category of a "person under 18 but 16 or older" — Vietnamese civil law elsewhere uses "người chưa thành niên" (minor, under 18) as a distinct concept from "trẻ em," and the PDPL's Article 24 protections are framed around "trẻ em," not "người chưa thành niên." Whether the extra protections of Article 24 reach 16–17 year-olds is not addressed by the retrieved text.
- Article 24 does not specifically address camera/video recording of children as a distinct case (e.g., whether Article 32's public-recording, no-consent basis and Article 24's rules interact, such as whether filming children playing on a court and giving that footage to an adult Booker would count as "công bố, tiết lộ thông tin về đời sống riêng tư" requiring the double consent). This is not resolved by the text.

---

## Summary table of article citations by question

| # | Topic | Primary citation(s) |
|---|---|---|
| 1 | Current status | Law 91/2025/QH15 Art. 38.1; Decree 356/2025/NĐ-CP Art. 42.1–42.2 |
| 2 | Image as personal/sensitive data | Law Art. 2.1–2.3, Art. 31.2; Decree 356 Art. 3.6, Art. 4.1(đ) |
| 3 | Notice basis for filming | Law Art. 32.1–32.2, Art. 9.4(d), Art. 19.1–19.2 |
| 4 | Disclosure to a third party | Law Art. 3.2, Art. 15.2, Art. 16, Art. 17, Art. 32.3; Decree 356 Art. 7.1, 7.3, 7.6 |
| 5 | Data subject rights & deadlines | Law Art. 4.1, 4.5, 14.2; Decree 356 Art. 5 |
| 6 | Retention cap | Law Art. 3.3, Art. 32.4, Art. 14.1(c) |
| 7 | Impact assessment / small-business threshold / notification | Law Art. 20, 21, 22, 23.1, 38.2–38.3; Decree 356 Art. 41 |
| 8 | Minors | Law Art. 24 |

---

## Sources used

1. **Law on Personal Data Protection**, Law No. 91/2025/QH15, passed by the National Assembly of the Socialist Republic of Vietnam (15th Legislature, 9th Session) on 26 June 2025, effective 1 January 2026. Retrieved as the official Gazette PDF: Công báo (Official Gazette of Vietnam) Nos. 971+972, dated 24 July 2025, published via `congbao.chinhphu.vn` — direct file: `https://congbaocdn.chinhphu.vn/CongBaoCP/VanBan/2025/6/45578/57730-1-2025971-97291-2025-qh15.pdf` (gazette landing page: `https://congbao.chinhphu.vn/tai-ve-van-ban-so-91-2025-qh15-45578-57730?format=pdf`).

2. **Decree No. 356/2025/NĐ-CP**, dated 31 December 2025, "Quy định chi tiết một số điều và biện pháp thi hành Luật Bảo vệ dữ liệu cá nhân" (Detailing a number of articles and implementation measures of the Law on Personal Data Protection), effective 1 January 2026, replacing Decree 13/2023/NĐ-CP. Retrieved as the official Gazette PDF: Công báo No. 18, dated 18 January 2026, published via `congbao.chinhphu.vn` (landing page: `https://congbao.chinhphu.vn/van-ban/nghi-dinh-so-356-2025-nd-cp-468371.htm`).

3. **Decree No. 13/2023/NĐ-CP**, dated 17 April 2023, "về bảo vệ dữ liệu cá nhân" (on personal data protection) — referenced only to confirm its supersession; its own provisions are not relied on for any of the eight questions above, since it is no longer in force as of the reporting date. Confirmed as repealed by Decree 356/2025/NĐ-CP, Article 42.2 (see source 2).

4. Secondary sources consulted only to locate/confirm the primary texts and their effective/promulgation dates (not relied on for any substantive legal conclusion above): `thuvienphapluat.vn` news/summary pages on Law 91/2025/QH15 and Decree 356/2025/NĐ-CP effective dates; `baochinhphu.vn` and `bocongan.gov.vn` news items confirming the 1 January 2026 effective date of the Law.
