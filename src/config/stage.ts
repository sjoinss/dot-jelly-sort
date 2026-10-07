/**
 * 스테이지 설정 (기획서 5번). 숫자만 바꿔서 난이도·가림 등장 위치를 조정한다.
 */
export const STAGE = {
  /** 일반 스테이지 수. 이후는 무한 모드 */
  FINITE_STAGE_COUNT: 50,
  /** 병 용량 */
  CAPACITY: 4,
  /** 빈 병 수 */
  EMPTY_BOTTLES: 2,
  /** 한 판 되돌리기 횟수 */
  UNDO_LIMIT: 3,

  /** 일반 스테이지 종류 수: 3에서 시작해 TYPES_STEP 스테이지마다 1씩, 최대 TYPES_MAX */
  TYPES_MIN: 3,
  TYPES_STEP: 5,
  TYPES_MAX: 12,

  /** 무한 모드 종류 수: INFINITE_TYPES_MIN에서 INFINITE_TYPES_STEP 스테이지마다 1씩, 최대 INFINITE_TYPES_MAX. 판마다 1개 적게 나올 수 있다 */
  INFINITE_TYPES_MIN: 12,
  INFINITE_TYPES_STEP: 20,
  INFINITE_TYPES_MAX: 14,

  /** 일반 스테이지 중 가림(?) 스테이지 번호 */
  HIDDEN_STAGES: [32, 36, 40, 43, 46, 49] as readonly number[],
  /** 무한 모드 가림 확률: 처음 10%, HIDDEN_CHANCE_STEP_EVERY 스테이지마다 +2%, 최대 20% */
  HIDDEN_CHANCE_START: 0.1,
  HIDDEN_CHANCE_STEP: 0.02,
  HIDDEN_CHANCE_STEP_EVERY: 10,
  HIDDEN_CHANCE_MAX: 0.2,

  /** 별: 이동 횟수가 (최소 이동 추정치 × 배율) 이하면 */
  STAR3_RATIO: 1.15,
  STAR2_RATIO: 1.5,
} as const;
