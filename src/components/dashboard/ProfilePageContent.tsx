/**
 * @file ProfilePageContent.tsx
 * @description 个人主页内容区（服务端组件）：左侧渲染用户资料卡（头像、简介、标签、所在地、社交链接、统计与操作按钮），
 * 右侧挂载 ProfileTabs 展示文章/草稿/收藏列表。数据全部由上层页面预取后以 props 注入，本组件不做取数，仅负责展示与拼装。
 * @warning 文案函数 t 由调用方注入，便于不同入口（本人主页 / 他人主页）复用同一套渲染
 */
import { MapPin, Globe, Calendar, Users, Check, PenLine, UserPen } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { StatsGrid } from "@/components/ui/StatsGrid";
import type { Locale } from "@/i18n/config";
import { getInitials, formatCount, formatDate } from "@/lib/format";
import type { Post, User } from "@shared";
import { ProfileTabs } from "./ProfileTabs";

/** Twitter 品牌图标（内联 SVG，随文字颜色着色，声明 aria-hidden 不干扰无障碍树） */
function TwitterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="16" height="16">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/** GitHub 品牌图标（内联 SVG） */
function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="16" height="16">
      <path d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.1 3.29 9.42 7.86 10.95.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.06-.73.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.4-1.27.73-1.56-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.53 11.53 0 0 0 23.5 12C23.5 5.74 18.27.5 12 .5z" />
    </svg>
  );
}

/** LinkedIn 品牌图标（内联 SVG） */
function LinkedinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="16" height="16">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

/** 资料卡元信息行图标的统一样式类 */
const META_ICON = "size-3.5 text-faint";

/**
 * ProfilePageContent 个人主页内容
 * @param props {@link ProfilePageContentProps} 以行内对象类型声明
 * @returns 左侧资料卡 + 右侧 Tab 列表的两栏布局
 */
export function ProfilePageContent({
  user,
  published,
  favorites,
  drafts,
  locale,
  t,
}: {
  /** 展示的用户资料 */
  user: User;
  /** 该用户已发布的文章列表 */
  published: Post[];
  /** 该用户收藏的文章列表，仅本人主页会传入非空数据 */
  favorites: Post[];
  /** 该用户的草稿列表，仅本人主页会传入非空数据 */
  drafts: Post[];
  /** 当前语言，用于日期本地化展示 */
  locale: Locale;

  /** 文案函数，由调用方按场景注入（本人 / 他人主页的键集合不同） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: any, values?: any) => string;
}) {
  /** 头像无图时的姓名首字母缩写 */
  const userInitials = getInitials(user.firstName, user.lastName);

  /** 资料卡统计指标（文章数 / 获赞数 / 浏览量），缺失时按 0 兜底并格式化为紧凑写法 */
  const stats = [
    { label: t("statsArticles"), value: formatCount(user.stats?.articles ?? 0) },
    { label: t("statsLikes"), value: formatCount(user.stats?.likes ?? 0) },
    { label: t("statsViews"), value: formatCount(user.stats?.views ?? 0) },
  ];

  /** Twitter 链接：已是完整地址直接用，否则按用户名补全为 twitter.com 主页（去掉可能的 @ 前缀） */
  const socialTwitter = user.social?.twitter
    ? user.social.twitter.startsWith("http")
      ? user.social.twitter
      : `https://twitter.com/${user.social.twitter.replace("@", "")}`
    : undefined;

  /** GitHub 链接：已是完整地址直接用，否则按用户名补全为 github.com 主页 */
  const socialGithub = user.social?.github
    ? user.social.github.startsWith("http")
      ? user.social.github
      : `https://github.com/${user.social.github}`
    : undefined;

  /** LinkedIn 链接：已是完整地址直接用，否则按用户名补全为 linkedin.com/in 主页 */
  const socialLinkedin = user.social?.linkedin
    ? user.social.linkedin.startsWith("http")
      ? user.social.linkedin
      : `https://linkedin.com/in/${user.social.linkedin}`
    : undefined;

  /** 是否至少存在一个社交链接，决定社交图标区块是否渲染 */
  const hasSocial = !!(socialTwitter || socialGithub || socialLinkedin);

  return (
    // 两栏布局：宽屏左侧固定 300px 资料卡，窄屏堆叠为单栏
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[300px_1fr] lg:gap-12">
      <aside className="animate-fade-in">
        {/* 宽屏下资料卡吸顶跟随滚动，窄屏恢复常规布局 */}
        <div className="sticky-below-nav max-lg:static">
          <section className="overflow-hidden card shadow-(--shadow-sm)">
            {/* 资料卡顶部装饰色带 */}
            <div className="h-24 w-full profile-cover-band" />
            <div className="px-6 pb-7">
              {/* 头像上移压住色带下沿，形成叠放效果 */}
              <div className="-mt-5">
                <Avatar
                  size="lg"
                  src={user.avatar || undefined}
                  alt={`${user.firstName} ${user.lastName}`}
                  initials={userInitials}
                  className="border-4 border-card-bg"
                />
              </div>

              <div className="mt-5">
                <div className="row-sm flex-wrap">
                  <h1 className="m-0 text-(length:--type-md) leading-tight font-bold tracking-[-0.02em] text-heading">
                    {user.firstName} {user.lastName}
                  </h1>
                  {/* 已认证标识，仅在 verified 为真时展示 */}
                  {user.verified && (
                    <span
                      role="img"
                      aria-label={t("verified")}
                      title={t("verified")}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent text-page"
                    >
                      <Check size={10} strokeWidth={2.5} />
                    </span>
                  )}
                </div>
                <p className="m-0 mt-1 meta-text">@{user.username}</p>
              </div>

              {/* 个人简介，为空时展示占位文案 */}
              <p className="mt-4 text-(length:--type-xs) leading-relaxed text-body">
                {user.bio || t("noBio")}
              </p>

              {/* 用户标签组，无标签时整块不渲染 */}
              {user.tags?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {user.tags.map((tag) => (
                    <span key={tag} className="chip-outline">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 元信息区：所在地 / 网站 / 加入时间 / 角色，各自按有值才展示 */}
              <div className="mt-5 space-y-2 text-(length:--type-2xs) leading-normal text-body">
                {user.location && (
                  <span className="row-sm">
                    <MapPin className={META_ICON} strokeWidth={2.5} />
                    {user.location}
                  </span>
                )}
                {user.website && (
                  // 外链统一新开标签页并带 noopener noreferrer，避免反向控制本页
                  <a
                    href={
                      user.website.startsWith("http") ? user.website : `https://${user.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="row-sm transition-colors hover:text-heading"
                  >
                    <Globe className={META_ICON} strokeWidth={2.5} />
                    {user.website}
                  </a>
                )}
                {user.joined && (
                  <span className="row-sm">
                    <Calendar className={META_ICON} strokeWidth={2.5} />
                    {formatDate(user.joined, locale)}
                  </span>
                )}
                <span className="row-sm">
                  <Users className={META_ICON} strokeWidth={2.5} />

                  {/* Writer 角色走本地化文案，其余角色直接显示原始值；公司名存在时追加展示 */}
                  {user.role === "Writer" ? t("roleWriter") : user.role}
                  {user.company ? ` · ${user.company}` : ""}
                </span>
              </div>

              {/* 社交链接组，至少有一个链接时才渲染 */}
              {hasSocial && (
                <div className="mt-5 row-sm">
                  {socialTwitter && (
                    <a
                      href={socialTwitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Twitter"
                      className="icon-btn"
                    >
                      <TwitterIcon />
                    </a>
                  )}
                  {socialGithub && (
                    <a
                      href={socialGithub}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="GitHub"
                      className="icon-btn"
                    >
                      <GithubIcon />
                    </a>
                  )}
                  {socialLinkedin && (
                    <a
                      href={socialLinkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="LinkedIn"
                      className="icon-btn"
                    >
                      <LinkedinIcon />
                    </a>
                  )}
                </div>
              )}

              <div className="mt-6 border-t border-stroke pt-6">
                <StatsGrid items={stats} />
              </div>

              {/* 操作区：写文章 / 编辑资料，两项等分宽度 */}
              <div className="mt-6 row-md">
                <Button href="/write" size="md" className="flex-1">
                  <PenLine size={16} strokeWidth={2.5} />
                  {t("writeArticle")}
                </Button>
                <Button href="/settings" variant="outline" size="md" className="flex-1">
                  <UserPen size={16} strokeWidth={2.5} />
                  {t("editProfile")}
                </Button>
              </div>
            </div>
          </section>
        </div>
      </aside>

      {/* 右侧列表区：文章 / 草稿 / 收藏 的 Tab 切换 */}
      <ProfileTabs published={published} favorites={favorites} drafts={drafts} />
    </div>
  );
}
