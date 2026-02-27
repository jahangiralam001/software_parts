const fallbackFilesystem = [
  {
    "path": "/",
    "title": "Root Filesystem",
    "parent": null,
    "what": "The top-level starting point of everything in Linux.",
    "why": "Linux treats all storage as one tree under '/'.",
    "realFiles": ["/bin", "/etc", "/usr", "/var"],
    "commands": ["ls -lah /", "tree -L 1 /"],
    "deleteImpact": "System becomes unusable immediately.",
    "difference": "Not the same as /root (root user's home directory).",
    "modern": "Still the canonical hierarchy, often spread across multiple mounted filesystems."
  },
  {
    "path": "/bin",
    "title": "Essential User Binaries",
    "parent": "/",
    "what": "Critical command binaries available for all users.",
    "why": "Boot/recovery mode still needs core commands.",
    "realFiles": ["/bin/ls", "/bin/cp", "/bin/mv"],
    "commands": ["ls /bin | head", "which ls"],
    "deleteImpact": "Most shell commands stop working.",
    "difference": "Compared with /sbin: /bin is not mainly admin-only.",
    "modern": "Many distros now symlink /bin -> /usr/bin."
  },
  {
    "path": "/boot",
    "title": "Boot Loader Files",
    "parent": "/",
    "what": "Kernel images and bootloader metadata.",
    "why": "System needs these files before normal userspace starts.",
    "realFiles": ["/boot/vmlinuz-*", "/boot/initrd.img-*", "/boot/grub/grub.cfg"],
    "commands": ["ls -lah /boot", "sudo cat /boot/grub/grub.cfg | head"],
    "deleteImpact": "System may fail to boot.",
    "difference": "Unlike /, this is focused strictly on startup files.",
    "modern": "UEFI systems may also use /boot/efi for firmware boot files."
  },
  {
    "path": "/dev",
    "title": "Device Files",
    "parent": "/",
    "what": "Special files representing hardware and virtual devices.",
    "why": "Linux exposes devices through files for uniform access.",
    "realFiles": ["/dev/sda", "/dev/null", "/dev/tty", "/dev/random"],
    "commands": ["ls -lah /dev | head", "stat /dev/null"],
    "deleteImpact": "Device communication breaks; system becomes unstable.",
    "difference": "Not regular data files like in /var or /home.",
    "modern": "Mostly managed dynamically by udev/devtmpfs."
  },
  {
    "path": "/etc",
    "title": "System Configuration",
    "parent": "/",
    "what": "Host-specific system configuration files.",
    "why": "Keeps runtime settings separate from executable binaries.",
    "realFiles": ["/etc/passwd", "/etc/fstab", "/etc/ssh/sshd_config"],
    "commands": ["ls /etc | head", "sudo grep -v '^#' /etc/fstab"],
    "deleteImpact": "Services and logins fail due to missing config.",
    "difference": "Unlike /usr, /etc stores local machine config, not app binaries.",
    "modern": "Systemd and modern services still heavily depend on /etc overrides."
  },
  {
    "path": "/home",
    "title": "User Home Directories",
    "parent": "/",
    "what": "Default personal workspace for non-root users.",
    "why": "Separates user data from system files.",
    "realFiles": ["/home/alex/.bashrc", "/home/alex/Documents", "/home/alex/.config"],
    "commands": ["ls -lah /home", "du -sh /home/*"],
    "deleteImpact": "Users lose personal files and settings.",
    "difference": "Unlike /root, this is for non-root accounts.",
    "modern": "Desktop environments store lots of app state under ~/.config and ~/.local."
  },
  {
    "path": "/lib",
    "title": "Essential Shared Libraries",
    "parent": "/",
    "what": "Core shared libraries and kernel modules.",
    "why": "Binaries need these dependencies to run.",
    "realFiles": ["/lib/x86_64-linux-gnu/libc.so.6", "/lib/modules/*"],
    "commands": ["ls /lib | head", "ldd /bin/ls"],
    "deleteImpact": "Programs fail with missing library errors.",
    "difference": "Compared with /usr/lib, /lib focuses on essential boot/runtime libs.",
    "modern": "Often symlinked to /usr/lib on merged-/usr systems."
  },
  {
    "path": "/opt",
    "title": "Optional Third-party Software",
    "parent": "/",
    "what": "Add-on software installed outside distro package defaults.",
    "why": "Keeps vendor/self-contained apps isolated.",
    "realFiles": ["/opt/google/chrome", "/opt/my-company-agent"],
    "commands": ["ls -lah /opt", "find /opt -maxdepth 2 -type d"],
    "deleteImpact": "Only applications in /opt break.",
    "difference": "Unlike /usr, /opt is often vendor-managed and self-contained.",
    "modern": "Containers reduce dependence, but enterprise tools still use /opt heavily."
  },
  {
    "path": "/proc",
    "title": "Kernel and Process Virtual Files",
    "parent": "/",
    "what": "Virtual filesystem exposing process and kernel runtime state.",
    "why": "Lets tools inspect system internals via file-like interfaces.",
    "realFiles": ["/proc/cpuinfo", "/proc/meminfo", "/proc/<pid>/status"],
    "commands": ["cat /proc/cpuinfo | head", "cat /proc/meminfo | head"],
    "deleteImpact": "You cannot truly delete it permanently; unmounting breaks system introspection.",
    "difference": "Unlike /var, contents are generated in memory, not stored on disk.",
    "modern": "Still central for observability; many tools wrap /proc data."
  },
  {
    "path": "/root",
    "title": "Root User Home",
    "parent": "/",
    "what": "Personal home directory of the root user.",
    "why": "Keeps admin profile separate even when /home is unavailable.",
    "realFiles": ["/root/.bashrc", "/root/.ssh/authorized_keys"],
    "commands": ["sudo ls -lah /root", "sudo find /root -maxdepth 1 -type f"],
    "deleteImpact": "Root's history, scripts, and SSH keys may be lost.",
    "difference": "Not the same as '/' and not for normal users.",
    "modern": "Still unchanged across major distributions."
  },
  {
    "path": "/sbin",
    "title": "Essential System Binaries",
    "parent": "/",
    "what": "Low-level binaries mainly for system administration.",
    "why": "Boot and repair tasks need admin commands.",
    "realFiles": ["/sbin/fsck", "/sbin/reboot", "/sbin/ip"],
    "commands": ["ls /sbin | head", "which fsck"],
    "deleteImpact": "System repair and networking tools fail.",
    "difference": "Compared with /bin, /sbin traditionally holds admin-focused commands.",
    "modern": "Often symlinked to /usr/sbin on merged-/usr distros."
  },
  {
    "path": "/tmp",
    "title": "Temporary Files",
    "parent": "/",
    "what": "Short-lived temporary storage for apps and scripts.",
    "why": "Provides a writable scratch area shared by processes.",
    "realFiles": ["/tmp/tmp.XYZ123", "/tmp/.X11-unix"],
    "commands": ["ls -lah /tmp | head", "find /tmp -type f | head"],
    "deleteImpact": "Running apps may crash if their temp files vanish.",
    "difference": "Unlike /var/tmp, /tmp is often cleaned at reboot.",
    "modern": "Many systems mount /tmp as tmpfs (memory-backed)."
  },
  {
    "path": "/usr",
    "title": "Userland Programs and Data",
    "parent": "/",
    "what": "Most user-space applications, libraries, docs, and shared resources.",
    "why": "Organizes non-boot-critical software in one hierarchy.",
    "realFiles": ["/usr/bin/python3", "/usr/lib", "/usr/share/man"],
    "commands": ["ls /usr", "du -sh /usr/* | sort -h | tail"],
    "deleteImpact": "Most software disappears; system barely usable.",
    "difference": "Unlike /etc, /usr mostly holds read-only packaged files.",
    "modern": "Merged-/usr puts more formerly root-level directories under /usr."
  },
  {
    "path": "/var",
    "title": "Variable Runtime Data",
    "parent": "/",
    "what": "Data that changes frequently: logs, caches, spools, databases.",
    "why": "Separates changing runtime state from static program files.",
    "realFiles": ["/var/log/syslog", "/var/cache/apt", "/var/lib/docker"],
    "commands": ["ls -lah /var/log | head", "du -sh /var/* | sort -h"],
    "deleteImpact": "Logs, package metadata, or service data can be lost.",
    "difference": "Unlike /tmp, /var stores longer-lived changing data.",
    "modern": "Container and service data growth often makes /var a separate partition."
  }
];

const fallbackExamples = {
  "/etc": [
    "Check how the system mounts disks by reading /etc/fstab.",
    "Inspect user login shell defaults in /etc/passwd."
  ],
  "/var": [
    "Diagnose service failures with files in /var/log.",
    "Watch app growth in /var/lib to plan disk capacity."
  ],
  "/usr": [
    "Find installed binaries with 'which' and trace to /usr/bin.",
    "Read package-shipped docs in /usr/share/doc."
  ],
  "/tmp": [
    "Test scripts by writing temp files, then clean up safely.",
    "Debug installers that fail due to low /tmp space."
  ]
};

const fallbackComparisons = {
  "/bin": [
    { "with": "/sbin", "focus": "Audience", "difference": "/bin is general user commands, /sbin is mostly system admin commands." },
    { "with": "/usr/bin", "focus": "Modern layout", "difference": "On many systems /bin is now a symlink to /usr/bin." }
  ],
  "/tmp": [
    { "with": "/var/tmp", "focus": "Retention", "difference": "/tmp is usually cleaned on reboot; /var/tmp is kept longer." }
  ],
  "/etc": [
    { "with": "/usr", "focus": "Purpose", "difference": "/etc stores machine-specific config; /usr stores packaged programs and shared data." }
  ],
  "/root": [
    { "with": "/", "focus": "Meaning", "difference": "'/root' is the root user's home; '/' is the full filesystem root." },
    { "with": "/home", "focus": "Users", "difference": "/root is for root only; /home is for regular users." }
  ],
  "/var": [
    { "with": "/tmp", "focus": "Data lifetime", "difference": "/var has persistent changing data; /tmp is short-lived scratch space." }
  ]
};

const fallbackQuizzes = {
  "/": {
    "question": "Which directory is the top-level starting point of the Linux filesystem tree?",
    "options": ["/root", "/", "/home", "/usr"],
    "answer": "/",
    "explanation": "Everything in Linux is mounted under '/'."
  },
  "/etc": {
    "question": "Where do host-specific system configuration files usually live?",
    "options": ["/etc", "/usr", "/var", "/opt"],
    "answer": "/etc",
    "explanation": "Linux keeps local configuration in /etc."
  },
  "/tmp": {
    "question": "Which directory is typically cleaned at reboot on many systems?",
    "options": ["/var", "/usr", "/tmp", "/home"],
    "answer": "/tmp",
    "explanation": "/tmp is designed for temporary, short-lived files."
  },
  "/var": {
    "question": "Where are logs like syslog typically stored?",
    "options": ["/var/log", "/etc/log", "/usr/log", "/boot/log"],
    "answer": "/var/log",
    "explanation": "Changing runtime data such as logs goes under /var."
  }
};

const fallbackSubtrees = {
  "/": [
    { "name": "bin", "description": "Essential user commands needed by shell/scripts." },
    { "name": "boot", "description": "Kernel and bootloader files used at startup." },
    { "name": "dev", "description": "Device files for disks, terminals, and pseudo-devices." },
    { "name": "etc", "description": "System-wide host-specific configuration files." },
    { "name": "home", "description": "Home directories for normal users." },
    { "name": "lib", "description": "Essential shared libraries and modules." },
    { "name": "lib32", "description": "32-bit compatibility libraries on multilib systems." },
    { "name": "lib64", "description": "64-bit runtime libraries and loader paths." },
    { "name": "libx32", "description": "Libraries for x32 ABI (less common)." },
    { "name": "media", "description": "Auto-mounted removable media directories." },
    { "name": "mnt", "description": "Temporary manual mount points for admins." },
    { "name": "opt", "description": "Optional/vendor-provided software installs." },
    { "name": "proc", "description": "Virtual kernel/process information filesystem." },
    { "name": "root", "description": "Home directory of root user." },
    { "name": "run", "description": "Volatile runtime state (PID, sockets, service data)." },
    { "name": "sbin", "description": "Essential system administration binaries." },
    { "name": "srv", "description": "Service data intended to be served by daemons." },
    { "name": "sys", "description": "Kernel object and device model interface." },
    { "name": "tmp", "description": "Temporary short-lived files." },
    { "name": "usr", "description": "Userland programs, libraries, docs, and shared assets." },
    { "name": "var", "description": "Variable data: logs, cache, spool, state." },
    { "name": "lost+found", "description": "Recovered filesystem fragments from fsck." }
  ],
  "/usr": [
    { "name": "bin", "description": "Most user commands installed by packages." },
    { "name": "sbin", "description": "Non-essential admin commands from packages." },
    { "name": "lib", "description": "Libraries used by programs in /usr/bin and /usr/sbin." },
    { "name": "lib64", "description": "64-bit libraries under /usr hierarchy." },
    { "name": "local", "description": "Admin-installed software outside package manager control." },
    { "name": "share", "description": "Architecture-independent files (man pages, docs, locale)." },
    { "name": "include", "description": "Header files for compiling software." },
    { "name": "src", "description": "Optional source code or kernel source trees." }
  ],
  "/var": [
    { "name": "log", "description": "System and application logs for troubleshooting." },
    { "name": "lib", "description": "Persistent service/package state data." },
    { "name": "cache", "description": "Rebuildable cached data to improve performance." },
    { "name": "tmp", "description": "Longer-lived temporary files than /tmp." },
    { "name": "spool", "description": "Queued work like print/mail jobs waiting processing." },
    { "name": "backups", "description": "Backup copies created by system tools." },
    { "name": "opt", "description": "Variable data for applications installed in /opt." },
    { "name": "mail", "description": "User mailboxes (on systems using local mail storage)." }
  ],
  "/etc": [
    { "name": "passwd", "description": "User account metadata (name, uid, shell, home path)." },
    { "name": "shadow", "description": "Secured password hashes and account aging rules." },
    { "name": "group", "description": "Group definitions and group memberships." },
    { "name": "hosts", "description": "Static hostname-to-IP mappings." },
    { "name": "fstab", "description": "Filesystem mount definitions used during boot." },
    { "name": "systemd", "description": "Systemd unit files, drop-ins, and service overrides." },
    { "name": "network", "description": "Network interface and routing configuration (distro dependent)." },
    { "name": "ssh", "description": "SSH daemon/client configuration and host keys." },
    { "name": "cron.d", "description": "Additional scheduled cron job definitions." },
    { "name": "profile.d", "description": "Shell startup scripts loaded for login sessions." }
  ]
};

async function fetchJson(url, fallback) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return await response.json();
  } catch {
    return fallback;
  }
}

export async function loadAllData(basePath = ".") {
  const [filesystem, examples, comparisons, quizzes, subtrees] = await Promise.all([
    fetchJson(`${basePath}/data/filesystem.json`, fallbackFilesystem),
    fetchJson(`${basePath}/data/examples.json`, fallbackExamples),
    fetchJson(`${basePath}/data/comparisons.json`, fallbackComparisons),
    fetchJson(`${basePath}/data/quizzes.json`, fallbackQuizzes),
    fetchJson(`${basePath}/data/subtrees.json`, fallbackSubtrees)
  ]);

  return { filesystem, examples, comparisons, quizzes, subtrees };
}

export function getDirectoryByPath(filesystem, path) {
  return filesystem.find((entry) => entry.path === path) || null;
}
