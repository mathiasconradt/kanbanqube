class Kanbanqube < Formula
  desc "Local-first Kanban board backed by normal files"
  homepage "https://github.com/mathiasconradt/kanbanqube"
  version "1.0.14"
  url "https://github.com/mathiasconradt/kanbanqube/releases/download/v#{version}/kanbanqube-#{version}.tgz"
  sha256 "3883a10e4df2e5b3277506ef96ffaad11e55be09a9eb3b014e181493e082c64f"
  license "Apache-2.0"

  depends_on "node"

  def install
    app_root = buildpath/"package"
    libexec.install app_root.children
    bin.write_exec_script libexec/"server.js"
  end

  test do
    system bin/"kanbanqube", "--help"
  end
end
