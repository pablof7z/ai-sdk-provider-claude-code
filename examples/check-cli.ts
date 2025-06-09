import { execSync } from 'child_process';

console.log('Checking Claude CLI installation...\n');

try {
  // Check if Claude CLI is installed
  const version = execSync('claude --version', { encoding: 'utf8' }).trim();
  console.log('✅ Claude CLI is installed');
  console.log('Version:', version);
  
  console.log('\nNow checking authentication...');
  
  try {
    // Try a simple command that requires auth
    const result = execSync(
      'claude -p "Say hello" --print --output-format json --dangerously-skip-permissions', 
      { encoding: 'utf8', stdio: 'pipe' }
    );
    
    // Parse the JSON response to verify it worked
    const response = JSON.parse(result.trim());
    if (response.result || response.is_error === false) {
      console.log('✅ Claude CLI is authenticated\n');
      console.log('You can run the examples and integration tests!');
    } else {
      console.log('❌ Claude CLI returned an error\n');
      console.log('Please check your authentication: claude login');
    }
  } catch (authError: any) {
    if (authError.status === 127) {
      console.log('❌ Claude CLI command failed');
    } else if (authError.stderr?.includes('authentication') || authError.status === 401) {
      console.log('❌ Claude CLI is not authenticated\n');
      console.log('Please run: claude login');
    } else {
      console.log('❌ Failed to verify authentication');
      console.log('Error:', authError.message);
    }
  }
} catch (error: any) {
  if (error.status === 127) {
    console.log('❌ Claude CLI is not installed or not in PATH');
    console.log('\nTo install: npm install -g @anthropic-ai/claude-code');
  } else {
    console.log('❌ Failed to run Claude CLI:', error.message);
    console.log('\nMake sure Claude CLI is installed:');
    console.log('npm install -g @anthropic-ai/claude-code');
  }
}