cask "kanbanqube-desktop" do
  version "1.0.26"
  sha256 :no_check

  on_arm do
    url "https://github.com/mathiasconradt/kanbanqube/releases/download/v#{version}/KanbanQube-macOS-arm64.zip"
  end
  on_intel do
    url "https://github.com/mathiasconradt/kanbanqube/releases/download/v#{version}/KanbanQube-macOS-x64.zip"
  end

  name "KanbanQube"
  desc "Local-first Kanban board desktop app"
  homepage "https://github.com/mathiasconradt/kanbanqube"

  depends_on macos: :big_sur

  app "KanbanQube.app"

  preflight do
    system_command "/usr/bin/xattr",
                   args: ["-cr", "#{staged_path}/KanbanQube.app"],
                   sudo: false
  end

  zap trash: [
    "~/Library/Application Support/KanbanQube",
    "~/Library/Preferences/com.mathiasconradt.kanbanqube.plist",
    "~/Library/Saved Application State/com.mathiasconradt.kanbanqube.savedState",
  ]
end
