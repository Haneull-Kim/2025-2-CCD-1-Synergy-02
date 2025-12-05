package com.synergy.bokja.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.synergy.bokja.dto.*;
import com.synergy.bokja.entity.*;
import com.synergy.bokja.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.Base64;
import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final UserMedicineRepository userMedicineRepository;
    private final CycleRepository cycleRepository;
    private final UserMedicineItemRepository userMedicineItemRepository;
    private final MedicineRepository medicineRepository;
    private final ConditionRepository conditionRepository;
    private final EffectRepository effectRepository;
    private final EventRepository eventRepository;
    private final ObjectMapper objectMapper;

    private static final Logger log = LoggerFactory.getLogger(ReportService.class);

    @Value("${python.script.llm}")
    private String llmScriptPath;

    /**
     * uno → umno 조회 (기존 컨트롤러 호출용, "대표" 복약정보 1건만 반환)
     * 목록 조회는 getUserReports(umno) 내부에서 uno 기준 전체를 조회함.
     */

    /** 현재 인증된 사용자 uno 조회 (요약/상세 조회에서 권한 검증용) */
    private Long getCurrentUserUno() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof Long)) {
            throw new IllegalStateException("인증 정보가 올바르지 않습니다.");
        }
        return (Long) principal;
    }

    /** [1] 리포트 목록 조회 - 사용자 기준으로 모든 복약기록에 대한 리포트 조회 */
    public ReportListResponseDTO getUserReports(Long uno) {

        // 1) 해당 사용자의 모든 복약 정보 조회
        List<UserMedicineEntity> allMeds = userMedicineRepository.findAllByUser_Uno(uno);
        if (allMeds == null || allMeds.isEmpty()) {
            return new ReportListResponseDTO(new ArrayList<>());
        }

        // 2) 모든 umno 리스트 추출
        List<Long> umnos = allMeds.stream()
                .map(UserMedicineEntity::getUmno)
                .collect(Collectors.toList());

        // 3) 이 umno들에 속한 모든 리포트 조회
        List<ReportEntity> reports = reportRepository.findAllByUserMedicine_UmnoIn(umnos);

        // 4) DTO 변환
        List<ReportItemDTO> reportList = reports.stream().map(r -> {
            CycleEntity cycle = cycleRepository.findByCyno(r.getCycle().getCyno());
            UserMedicineEntity med = r.getUserMedicine();

            return new ReportItemDTO(
                    r.getRno(),
                    med.getHospital(),
                    med.getCategory(),
                    cycle.getStartDate().toString(),
                    cycle.getEndDate().toString()
            );
        }).sorted(Comparator.comparing(ReportItemDTO::getStart_date).reversed()
                .thenComparing(Comparator.comparing(ReportItemDTO::getEnd_date).reversed()))
                .collect(Collectors.toList());

        return new ReportListResponseDTO(reportList);
    }

    /**
     * [2] 리포트 요약 조회
     * - event_table의 createdAt / updatedAt 기반으로 날짜별 g/y/r 계산
     *
     * 규칙:
     * - (createdCount == 0 인 경우는 적색으로 보지 않음. 알림이 없어서 평가 불가인 날로 취급)
     * - updatedCount == 0 → "r"
     * - 0 < updatedCount < createdCount → "y"
     * - updatedCount == createdCount → "g"
     */
    public ReportSummaryResponseDTO getReportSummary(Long rno) {
        Long currentUno = getCurrentUserUno();

        ReportEntity report = reportRepository.findByRno(rno)
                .orElseThrow(() -> new IllegalArgumentException("리포트가 존재하지 않습니다."));

        Long ownerUno = report.getUserMedicine().getUser().getUno();
        if (!Objects.equals(currentUno, ownerUno)) {
            throw new AccessDeniedException("해당 리포트에 접근할 권한이 없습니다.");
        }

        UserMedicineEntity med = userMedicineRepository.findByUmno(report.getUserMedicine().getUmno());
        CycleEntity cycle = cycleRepository.findByCyno(report.getCycle().getCyno());

        LocalDate startDate = cycle.getStartDate();
        LocalDate endDate = cycle.getEndDate();
        String start = startDate.toString();
        String end = endDate.toString();

        // 이 복약 정보(umno)에 해당하는 모든 event 조회
        List<EventEntity> allEventsForMed = eventRepository.findAllByUserMedicine_UmnoIn(
                Collections.singletonList(med.getUmno())
        );

        List<ColorDTO> colors = new ArrayList<>();

        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            LocalDate target = date;

            // createdAt 이 해당 날짜인 이벤트들
            List<EventEntity> dailyEvents = allEventsForMed.stream()
                    .filter(ev -> {
                        LocalDateTime created = ev.getCreatedAt();
                        if (created == null) return false;
                        return created.toLocalDate().equals(target);
                    })
                    .collect(Collectors.toList());

            long createdCount = dailyEvents.size();

            // updatedAt 이 해당 날짜인 이벤트들
            long updatedCount = dailyEvents.stream()
                    .filter(ev -> {
                        LocalDateTime updated = ev.getUpdatedAt();
                        if (updated == null) return false;
                        return updated.toLocalDate().equals(target);
                    })
                    .count();
            /**
             * 규칙:
             * - createdCount == 0  → colors에 추가하지 않음 (색상 없음)
             * - updatedCount == 0 → "r"
             * - 0 < updatedCount < createdCount → "y"
             * - updatedCount == createdCount → "g"
             */
            if (createdCount == 0) {
                continue;
            }

            String color;
            if (updatedCount == 0) {
                color = "r";
            } else if (updatedCount == createdCount) {
                color = "g";
            } else {
                color = "y";
            }

            colors.add(new ColorDTO(date.toString(), color));
        }

        return new ReportSummaryResponseDTO(
                report.getRno(),
                med.getHospital(),
                med.getCategory(),
                med.getTaken(),
                start,
                end,
                colors
        );
    }

    /**
     * [3] 리포트 상세 조회 + LLM 총평 생성 조건
     *
     * LLM 호출 조건:
     *  - 오늘 날짜 >= end_date + 1일 이면서
     *  - report.description 이 비어 있을 때(blank)
     *
     * 이외의 경우:
     *  - today != end_date + 1 && description 이 비어 있음 → 예외
     *  - description 이 이미 존재 → 예외
     *
     * LLM 호출 중 IOException / InterruptedException 발생 시:
     *  - "총평을 생성하지 못했습니다."로 fallback
     */
    public ReportDetailResponseDTO getReportDetail(Long rno) {
        Long currentUno = getCurrentUserUno();

        ReportEntity report = reportRepository.findByRno(rno)
                .orElseThrow(() -> new IllegalArgumentException("리포트가 존재하지 않습니다."));

        Long ownerUno = report.getUserMedicine().getUser().getUno();
        if (!Objects.equals(currentUno, ownerUno)) {
            throw new AccessDeniedException("해당 리포트에 접근할 권한이 없습니다.");
        }

        UserMedicineEntity userMedicine = userMedicineRepository.findByUmno(report.getUserMedicine().getUmno());
        CycleEntity cycle = cycleRepository.findByCyno(report.getCycle().getCyno());
        List<UserMedicineItemEntity> items =
                userMedicineItemRepository.findAllByUserMedicine_Umno(report.getUserMedicine().getUmno());

        // 약품 상세 정보
        List<MedicineDTO> medicineList = items.stream().map(i -> {
            MedicineEntity med = medicineRepository.findByMdno(i.getMedicine().getMdno());
            return new MedicineDTO(
                    med.getMdno(),
                    med.getName(),
                    med.getClassification(),
                    med.getImage(),
                    med.getInformation() != null ? med.getInformation() : i.getDescription()
            );
        }).collect(Collectors.toList());

        // 복약 주기 정보
        List<ReportCycleDTO> cycleList = List.of(
                new ReportCycleDTO(
                        cycle.getStartDate().toString(),
                        cycle.getEndDate().toString(),
                        cycle.getTotalCycle(),
                        cycle.getCurCycle(),
                        cycle.getSaveCycle()
                )
        );

        // 부작용 기록 통계 (주차별 집계)
        List<ReportEffectWeekDTO> effects = buildWeeklyEffectStats(
                userMedicine.getUser().getUno(),
                cycle.getStartDate(),
                cycle.getEndDate()
        );

        // --- 총평(description) 처리 로직 ---
        String description = report.getDescription();
        boolean hasDescription = (description != null && !description.isBlank());

        LocalDate today = LocalDate.now();
        LocalDate endDate = cycle.getEndDate();
        LocalDate expectedSummaryDate = endDate.plusDays(1);

        // 1) 이미 총평이 있는 경우 → 그냥 그대로 리턴 (LLM 호출 X)
        if (hasDescription) {
            return new ReportDetailResponseDTO(
                    report.getRno(),
                    userMedicine.getHospital(),
                    userMedicine.getCategory(),
                    userMedicine.getTaken(),
                    medicineList,
                    cycleList,
                    effects,
                    description
            );
        }

        // 2) 총평이 없고, 오늘이 end_date+1 이상일 때 LLM 호출
        if (!today.isBefore(expectedSummaryDate)) { // today >= expectedSummaryDate
            try {
                description = createReportDescription(userMedicine, cycle, effects);
                report.setDescription(description);
                reportRepository.save(report);
            } catch (Exception e) {
                log.error("[ReportService] 총평 생성 실패 - rno={}, umno={}, message={}",
                        report.getRno(),
                        userMedicine.getUmno(),
                        e.getMessage(), e);

                description = "총평을 생성하지 못했습니다.";
            }
        }
        // 3) 총평이 없고, 오늘이 종료 다음 날이 아닌 경우
        //    → LLM을 호출하지 않고, description(빈 문자열) 그대로 둔다.

        return new ReportDetailResponseDTO(
                report.getRno(),
                userMedicine.getHospital(),
                userMedicine.getCategory(),
                userMedicine.getTaken(),
                medicineList,
                cycleList,
                effects,
                description   // "", LLM 생성 텍스트, 기존 DB 값 중 하나
        );
    }

    /** 주차별 부작용 통계 생성 (ConditionEntity.time: LocalDateTime 기반) */
    private List<ReportEffectWeekDTO> buildWeeklyEffectStats(Long uno, LocalDate startDate, LocalDate endDate) {
        List<ReportEffectWeekDTO> result = new ArrayList<>();

        LocalDate start = startDate;
        LocalDate end = endDate;

        int weekIndex = 1;
        for (LocalDate wStart = start; !wStart.isAfter(end); wStart = wStart.plusWeeks(1)) {
            LocalDate wEnd = wStart.plusDays(6);
            if (wEnd.isAfter(end)) {
                wEnd = end;
            }

            LocalDateTime startDateTime = wStart.atStartOfDay();
            LocalDateTime endDateTime = wEnd.atTime(LocalTime.MAX);

            List<ConditionEntity> weekConditions =
                    conditionRepository.findAllByUser_UnoAndTimeBetween(
                            uno,
                            startDateTime,
                            endDateTime
                    );

            Map<Long, Long> counts = weekConditions.stream()
                    .collect(Collectors.groupingBy(
                            condition -> condition.getEffect().getEfno(),
                            Collectors.counting()
                    ));

            List<ReportEffectItemDTO> weekEffects = counts.entrySet().stream().map(e -> {
                EffectEntity effect = effectRepository.findByEfno(e.getKey());
                return new ReportEffectItemDTO(
                        effect.getEfno(),
                        effect.getName(),
                        e.getValue().intValue()
                );
            }).collect(Collectors.toList());

            result.add(new ReportEffectWeekDTO(weekIndex++, weekEffects));
        }

        return result;
    }

    /** Python 스크립트 실행 (디버깅 로그 추가 버전) */
    private String runPythonScript(String scriptPath, String... args)
            throws IOException, InterruptedException {

        List<String> command = new ArrayList<>();

        String osName = System.getProperty("os.name").toLowerCase();
        String pythonCmd = osName.contains("win") ? "python" : "python3";

        command.add(pythonCmd);
        command.add(scriptPath);
        command.addAll(Arrays.asList(args));

        ProcessBuilder pb = new ProcessBuilder(command);

        Map<String, String> env = pb.environment();
        env.put("PYTHONIOENCODING", "UTF-8");

        Process process = pb.start();

        StringBuilder output = new StringBuilder();
        try (BufferedReader reader =
                     new BufferedReader(new InputStreamReader(process.getInputStream(), "UTF-8"))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line);
            }
        }

        int exitCode = process.waitFor();
        String stdout = output.toString();

        if (exitCode != 0) {
            try (BufferedReader errorReader =
                         new BufferedReader(new InputStreamReader(process.getErrorStream(), "UTF-8"))) {
                String errorOutput = errorReader.lines().collect(Collectors.joining("\n"));
                log.error("[LLM] Python stderr = {}", errorOutput);
                throw new RuntimeException(
                        "Python script exited with code " + exitCode + ". Error: " + errorOutput
                );
            }
        }

        return stdout;
    }

    /** LLM을 이용해 리포트 설명(총평) 생성 */
    private String createReportDescription(UserMedicineEntity userMedicine,
                                           CycleEntity cycle,
                                           List<ReportEffectWeekDTO> effects)
            throws IOException, InterruptedException {

        Map<String, Object> payload = new HashMap<>();
        payload.put("hospital", userMedicine.getHospital());
        payload.put("category", userMedicine.getCategory());
        payload.put("taken", userMedicine.getTaken());
        payload.put("start_date", cycle.getStartDate().toString());
        payload.put("end_date", cycle.getEndDate().toString());
        payload.put("total_cycle", cycle.getTotalCycle());
        payload.put("cur_cycle", cycle.getCurCycle());
        payload.put("save_cycle", cycle.getSaveCycle());
        payload.put("effects", effects);

        // 1) JSON 문자열 생성
        String json = objectMapper.writeValueAsString(payload);
        log.info("[ReportService] LLM payload json = {}", json);

        // 2) JSON을 Base64로 인코딩
        String encodedPayload = Base64.getEncoder()
                .encodeToString(json.getBytes(StandardCharsets.UTF_8));

        // 3) Python 실행: 이제는 Base64 문자열을 인자로 전달
        String llmResult = runPythonScript(
                llmScriptPath,
                "report_summary",
                encodedPayload
        );

        if (llmResult == null || llmResult.isBlank()) {
            throw new IOException("LLM returned empty stdout");
        }

        // JSON → base64 문자열 파싱
        String encoded = objectMapper.readValue(llmResult, String.class);

        // base64 → UTF-8 디코딩
        byte[] decodedBytes = Base64.getDecoder().decode(encoded);
        String summary = new String(decodedBytes, StandardCharsets.UTF_8);

        // 5) 파싱 결과 로그
        log.info("[ReportService] [LLM parsed summary] {}", summary);

        if (summary == null || summary.isBlank()) {
            throw new IOException("LLM summary is empty after base64 decoding");
        }

        return summary;

    }
}
